import urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:8000/")
except Exception as e:
    with open("error.html", "wb") as f:
        f.write(e.read())
