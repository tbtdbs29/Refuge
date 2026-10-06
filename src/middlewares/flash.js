/** One-shot messages stored in the session and shown on the next page. */
export function flash(req, res, next) {
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) req.session.flash = null;
  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };
  next();
}
