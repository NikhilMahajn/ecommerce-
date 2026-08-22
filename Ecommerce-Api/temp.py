import requests
import os

url = "https://api.groq.com/openai/v1/models"

headers = {
    "Authorization": f"Bearer ",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)

print(response.json())