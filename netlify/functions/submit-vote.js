'use strict';

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase Admin environment variables for submit-vote');
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
      console.log('[submit-vote] Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.error('[submit-vote] Firebase Admin initialization failed:', err);
  }
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Payload must be a JSON object.' };
  }

  const orgId = typeof payload.orgId === 'string' ? payload.orgId.trim() : '';
  const electionId = typeof payload.electionId === 'string' ? payload.electionId.trim() : '';
  const rawSelections = Array.isArray(payload.selections) ? payload.selections : [];
  const clientRequestId = typeof payload.clientRequestId === 'string'
    ? payload.clientRequestId.trim().slice(0, 128)
    : null;

  if (!orgId) {
    return { valid: false, message: 'orgId is required.' };
  }
  if (!electionId) {
    return { valid: false, message: 'electionId is required.' };
  }
  if (!rawSelections.length) {
    return { valid: false, message: 'At least one selection is required.' };
  }
  if (rawSelections.length > 200) {
    return { valid: false, message: 'Too many selections provided.' };
  }

  const selections = [];
  for (const entry of rawSelections) {
    if (!entry || typeof entry !== 'object') {
      return { valid: false, message: 'Each selection must be an object.' };
    }
    const positionId = typeof entry.positionId === 'string' ? entry.positionId.trim() : '';
    const candidateId = typeof entry.candidateId === 'string' ? entry.candidateId.trim() : '';
    if (!positionId || !candidateId) {
      return { valid: false, message: 'Each selection requires positionId and candidateId.' };
    }
    selections.push({ positionId, candidateId });
  }

  return {
    valid: true,
    data: {
      orgId,
      electionId,
      selections,
      clientRequestId: clientRequestId || `srv-${Date.now()}`
    }
  };
}

function mapSelectionsByPosition(selections) {
  const map = new Map();
  selections.forEach(({ positionId, candidateId }) => {
    if (!map.has(positionId)) {
      map.set(positionId, []);
    }
    const list = map.get(positionId);
    if (!list.includes(candidateId)) {
      list.push(candidateId);
    }
  });
  return map;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'missing_token' });
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return jsonResponse(401, { error: 'missing_token' });
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error('[submit-vote] verifyIdToken error:', err);
    return jsonResponse(401, { error: 'invalid_token' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { error: 'invalid_json' });
  }

  const validation = validatePayload(payload);
  if (!validation.valid) {
    return jsonResponse(400, { error: 'invalid_payload', details: validation.message });
  }

  const { orgId, electionId, selections, clientRequestId } = validation.data;
  const positionMap = mapSelectionsByPosition(selections);
  const lockId = `${electionId}__${decodedToken.uid}`;
  const lockRef = firestore.doc(`vote_submissions/${lockId}`);
  const voteDocRef = firestore.doc(`votes/${lockId}`);
  const orgVoteRef = firestore.doc(`organizations/${orgId}/votes/${decodedToken.uid}`);
  const orgRef = firestore.doc(`organizations/${orgId}`);

  try {
    await firestore.runTransaction(async (tx) => {
      const lockSnapshot = await tx.get(lockRef);
      if (lockSnapshot.exists) {
        const error = new Error('already_voted');
        error.code = 'ALREADY_VOTED';
        throw error;
      }

      tx.create(lockRef, {
        orgId,
        electionId,
        uid: decodedToken.uid,
        clientRequestId,
        submittedAt: FieldValue.serverTimestamp()
      });

      tx.set(voteDocRef, {
        orgId,
        electionId,
        uid: decodedToken.uid,
        clientRequestId,
        selections,
        submittedAt: FieldValue.serverTimestamp()
      });

      positionMap.forEach((candidateIds, positionId) => {
        const itemRef = firestore.doc(`votes/${lockId}/items/${positionId}`);
        tx.set(itemRef, {
          orgId,
          electionId,
          uid: decodedToken.uid,
          positionId,
          candidateIds,
          recordedAt: FieldValue.serverTimestamp()
        });
      });

      const choices = {};
      positionMap.forEach((candidateIds, positionId) => {
        choices[positionId] = candidateIds.length === 1 ? candidateIds[0] : candidateIds;
      });

      tx.set(orgVoteRef, {
        orgId,
        electionId,
        voterId: decodedToken.uid,
        voterKey: decodedToken.uid,
        choices,
        authUid: decodedToken.uid,
        clientRequestId,
        votedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(orgRef, {
        voteCount: FieldValue.increment(1)
      }, { merge: true });

      positionMap.forEach(candidateIds => {
        candidateIds.forEach(candidateId => {
          const candidateRef = firestore.doc(`organizations/${orgId}/candidates/${candidateId}`);
          tx.set(candidateRef, {
            votes: FieldValue.increment(1)
          }, { merge: true });
        });
      });
    });

    return jsonResponse(200, { ok: true, submissionId: lockId });
  } catch (err) {
    if (err.code === 'ALREADY_VOTED') {
      return jsonResponse(409, { error: 'already_voted' });
    }
    console.error('[submit-vote] Transaction error:', err);
    return jsonResponse(500, { error: 'internal_error' });
  }
};
