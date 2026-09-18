const { randomUUID } = require("crypto");

// Tag every request so a failure the user reports ("it broke around 3pm") can be
// found in the logs. The id goes back on the response header, and the error
// handler puts it in the body of a 500 so there is something to quote.
module.exports = function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};
