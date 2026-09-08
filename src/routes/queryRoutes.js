// server/src/routes/queryRoutes.js
import express from "express";
import {
  searchKnowledge,
  handleFeedback,
} from "../controllers/queryController.js";

const router = express.Router();

router.post("/search", searchKnowledge);
router.post("/feedback", handleFeedback);

export default router;
