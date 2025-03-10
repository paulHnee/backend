const corsConfig = {
  origin: ['http://localhost:3000','https://10.1.2.2'], // Replace with your allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsConfig;