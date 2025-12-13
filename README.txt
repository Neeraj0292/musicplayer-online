YT Music Clone - Ready to Run

Instructions:
1. Extract the ZIP.
2. Create and activate a virtual environment (recommended).
   python -m venv venv
   source venv/bin/activate   # mac/linux
   venv\Scripts\activate    # windows
3. Install requirements:
   pip install -r requirements.txt
4. Ensure ffmpeg is installed on your system (yt-dlp may need it).
5. Run the Flask app:
   python app.py
6. Open http://localhost:5000 in your browser.

Notes:
- This project uses ytmusicapi and yt-dlp to fetch metadata and stream audio.
- Streaming via /play proxies audio through Flask; for production use a proper streaming server and respect YouTube's Terms of Service.
