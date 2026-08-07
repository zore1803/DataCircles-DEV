// middlewares/requestContext.js
//
// Establishes a per-request AsyncLocalStorage store so code deep in the stack —
// specifically the global change-notifier Mongoose plugin — can find out *who*
// is performing a database write, without every controller having to thread the
// current user through by hand.
//
// The store holds a reference to `req` (not a snapshot), because auth/userSync
// middleware populate `req.user` *after* this wrapper runs. By the time a model
// write actually happens inside a route handler, `req.user` is set, and the
// plugin reads it lazily via `als.getStore().req.user`.

const { AsyncLocalStorage } = require("async_hooks");

const als = new AsyncLocalStorage();

const requestContext = (req, res, next) => {
  als.run({ req }, () => next());
};

module.exports = { als, requestContext };
