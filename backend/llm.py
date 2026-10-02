from ollama import chat


class LLM:

    def __init__(self, model_name="llama3.2:3b"):
        """
        Initialize the local Ollama model.
        """

        self.model_name = model_name

    def generate(self, prompt):
        """
        Send a prompt to Ollama and return the response.
        """

        response = chat(

            model=self.model_name,

            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]

        )

        return response["message"]["content"]