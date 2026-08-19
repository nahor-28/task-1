export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: { message: result.error.issues[0].message, code: 'VALIDATION_ERROR' },
      });
    }
    req.body = result.data;
    next();
  };
}
