import { toNodeHandler } from "better-auth/node";
import express, { type Express } from "express";
import { envConfig } from "./config/env";

import { applyMiddleware } from "./middleware";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import indexRouter from "./routes/index.route";
import path from "path";
import { cwd } from "process";
const app: Express = express();



app.set("trust proxy", 1);

applyMiddleware(app);
app.use("/api",indexRouter)
app.set('views',path.join(`${cwd()}/src/templates`));


app.get("/health",async (_req, res) =>{

  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
});


app.get("/", (req, res) => {
  res.render("home");
});


export const startServer = async () => {
  // Vercel এ app.listen() কাজ করে না
  // শুধু local development এ করবে
    const PORT = envConfig.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    })
};


app.use(notFound);
app.use(errorHandler);



export default app;



