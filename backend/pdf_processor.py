import fitz


def extract_pages(pdf_path: str):
    """
    Extract text page by page.

    Returns:
    [
        {
            "page": 1,
            "text": "..."
        },
        {
            "page": 2,
            "text": "..."
        }
    ]
    """

    pages = []

    with fitz.open(pdf_path) as doc:

        for page_number, page in enumerate(doc, start=1):

            text = page.get_text()

            if text.strip():

                pages.append(
                    {
                        "page": page_number,
                        "text": text
                    }
                )

    return pages