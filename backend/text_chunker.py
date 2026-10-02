from langchain_text_splitters import RecursiveCharacterTextSplitter


splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=[
        "\n\n",
        "\n",
        ". ",
        " ",
        ""
    ]
)


def chunk_pages(pages):
    """
    Chunk every page while preserving page number.
    """

    chunked_documents = []

    chunk_id = 0

    for page in pages:

        chunks = splitter.split_text(
            page["text"]
        )

        for chunk in chunks:

            chunked_documents.append(
                {
                    "chunk_id": chunk_id,
                    "page": page["page"],
                    "text": chunk
                }
            )

            chunk_id += 1

    return chunked_documents