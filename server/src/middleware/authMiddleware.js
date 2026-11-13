const jwt = require('jsonwebtoken');

function authMiddleware(request, response, next) {
  const authorizationHeader = request.headers.authorization;
  const bearerMatch = authorizationHeader?.match(/^Bearer\s+(\S+)$/i);

  if (!bearerMatch) {
    return response.status(401).json({ message: 'Authorization token is required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not configured.');
    return response.status(500).json({ message: 'Server authentication is not configured.' });
  }

  try {
    // Restrict verification to the same algorithm used when creating tokens.
    const decodedToken = jwt.verify(bearerMatch[1], secret, {
      algorithms: ['HS256'],
    });

    if (
      typeof decodedToken !== 'object' ||
      !Number.isInteger(decodedToken.id) ||
      typeof decodedToken.email !== 'string'
    ) {
      return response.status(401).json({ message: 'Invalid or expired token.' });
    }

    request.user = {
      id: decodedToken.id,
      email: decodedToken.email,
    };

    return next();
  } catch (error) {
    return response.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;
