exports.handler = async () => {
  console.log("TEST FUNCTION EXECUTED");

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      message: "Runtime is executing correctly"
    })
  };
};
