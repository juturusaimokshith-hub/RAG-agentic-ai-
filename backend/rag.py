from embedding import generate_embeddings
from llm import LLM
import storage
from config import SEARCH_CANDIDATES, TOP_K


class RAG:

    def __init__(self):

        self.llm = LLM()

    def build_prompt(self, question, contexts):

        context_text = ""

        for context in contexts:

            context_text += f"""
Document : {context['pdf_name']}
Page     : {context['page']}

Content:
{context['text']}

----------------------------------------
"""

        prompt = f"""
You are an intelligent AI assistant answering questions about uploaded PDF documents.

Your primary objective is to provide accurate, concise, and helpful answers based on the provided context.

Instructions:

1. Read all retrieved context carefully before answering.
2. Use semantic understanding, not just exact keyword matching. Relevant information may be paraphrased or distributed across multiple context sections.
3. Combine information from multiple context blocks whenever necessary to produce a complete answer.
4. For questions asking for summaries, overviews, or thematic analysis, synthesize the information comprehensively from the context.
5. If the context partially answers the question, provide the best possible answer and clearly mention any missing information.
6. Do NOT invent, infer, or assume facts that are not supported by the provided context. However, you may summarize and logically structure the information.
7. If the answer truly cannot be determined from the provided context, and it's not a general summarization request, reply: "The requested information is not available in the uploaded PDF."
8. Do not mention the retrieval process, embeddings, chunks, or the provided context in your response.
9. Keep the answer focused on the user's question, but feel free to format it with lists or paragraphs for readability.
10. If the question refers to relationships or conclusions that can reasonably be derived from multiple context sections, you may explain them.
========================

CONTEXT

{context_text}

========================

QUESTION

{question}

========================

ANSWER
"""

        return prompt

    def ask(
        self,
        document_id,
        question
    ):

        if storage.vector_store is None:
            raise Exception("No PDF uploaded.")

        query_embedding = generate_embeddings(
            [
                {
                    "text": question
                }
            ]
        )[0]

        search_results = storage.vector_store.search(
            query_embedding=query_embedding,
            top_k=SEARCH_CANDIDATES
        )

        filtered_results = []

        for item in search_results:

            if item["document_id"] == document_id:

                filtered_results.append(item)

            if len(filtered_results) == TOP_K:
                break

        if len(filtered_results) == 0:

            return {

                "answer": "The selected PDF does not contain relevant information.",

                "sources": []

            }

        prompt = self.build_prompt(
            question,
            filtered_results
        )

        answer = self.llm.generate(prompt)

        return {
            "answer": answer,
            "sources": filtered_results
        }

    def generate_title(self, question: str) -> str:
        prompt = f"""
Generate a very short title (maximum 4 words) for a chat session that starts with the following question.
Do not use quotes or punctuation. Just return the short title.

Question:
{question}

Title:
"""
        title = self.llm.generate(prompt).strip().strip('"').strip("'")
        
        # Fallback if the LLM goes rogue
        if len(title.split()) > 7:
            title = " ".join(title.split()[:4]) + "..."
            
        return title