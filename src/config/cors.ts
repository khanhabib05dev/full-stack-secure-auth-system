export const corsConfig = {
  origin: ['http://localhost:5173','http://localhost:3000',"https://re-cap-gules.vercel.app"],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
};


