const corsConfig = {
  origin: ['http://localhost:3000'], // Replace with your allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsConfig;