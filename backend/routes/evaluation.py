from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import get_current_user
from services.evaluation import evaluate_rag_pipeline

router = APIRouter(prefix="/api")


class TestQuestion(BaseModel):
    question: str
    ground_truth: str | None = None


class EvaluationRequest(BaseModel):
    test_questions: list[TestQuestion]
    root_folder_id: str | None = None


@router.post("/evaluate")
async def evaluate_pipeline(request: EvaluationRequest, user_id: str = Depends(get_current_user)):
    """Evaluate the RAG pipeline using RAGAS metrics.

    Runs each test question through the full retrieval + generation pipeline,
    then scores with Faithfulness, Answer Relevancy, Context Precision/Recall.
    """
    questions = [q.model_dump() for q in request.test_questions]
    result = await evaluate_rag_pipeline(
        test_questions=questions,
        user_id=user_id,
        root_folder_id=request.root_folder_id,
    )
    return result
