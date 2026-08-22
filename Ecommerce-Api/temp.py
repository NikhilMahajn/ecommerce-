import requests
import os

url = "https://api.groq.com/openai/v1/models"

headers = {
    "Authorization": f"Bearer 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",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)

print(response.json())