import os
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from ytmusicapi import YTMusic
import yt_dlp
import requests

app = Flask(__name__, static_folder="static", static_url_path="/static")

# Initialize YTMusic without cache=True (compatibility)
yt = YTMusic()

ydl_opts = {
    "format": "bestaudio",
    "quiet": True,
    "skip_download": True,
    "cookiefile": "cookies.txt",
    "nocheckcertificate": True,
}

# simple in-memory history (server-side), frontend also stores in localStorage
LISTEN_HISTORY = []

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# Search endpoint: /search?q=...
@app.route('/search')
def search():
    q = request.args.get('q', '')
    limit = int(request.args.get('limit', 12))
    if not q:
        return jsonify([])
    try:
        results = yt.search(q, filter="songs", limit=limit)
        out = []
        for r in results:
            out.append({
                "title": r.get("title"),
                "artists": [a.get("name") for a in r.get("artists", [])] if r.get("artists") else [],
                "videoId": r.get("videoId"),
                "duration": r.get("duration"),
                "thumbnails": r.get("thumbnails", [])
            })
        return jsonify(out)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Trend endpoint: /trending
@app.route('/trending')
def trending():
    # Use a generic search for trending songs (best-effort)
    try:
        results = yt.search("latest punjabi songs", filter="songs", limit=5)
        out = [{"title": r.get("title"),
                "artists": [a.get("name") for a in r.get("artists", [])] if r.get("artists") else [],
                "videoId": r.get("videoId"),
                "thumbnails": r.get("thumbnails", [])} for r in results]
        return jsonify(out)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Recommend endpoint: /recommend?videoId=...
@app.route('/recommend')
def recommend():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify([])
    try:
        playlist = yt.get_watch_playlist(video_id)
        tracks = playlist.get("tracks", [])[:10]
        out = []
        for t in tracks:
            out.append({
                "title": t.get("title"),
                "artists": [a.get("name") for a in t.get("artists", [])] if t.get("artists") else [],
                "videoId": t.get("videoId"),
                "thumbnails": t.get("thumbnails", [])
            })
        return jsonify(out)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Play endpoint: /play?videoId=... -> proxies audio stream using yt-dlp
@app.route('/play')
def play():
    video_id = request.args.get('videoId')
    if not video_id:
        return "missing videoId", 400
    url = f"https://www.youtube.com/watch?v={video_id}"

    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'prefer_ffmpeg': True,
    }

    def generate():
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                direct_url = info.get('url')
                if not direct_url:
                    return
                headers = {"User-Agent": "python-requests/2.x"}
                with requests.get(direct_url, stream=True, headers=headers, timeout=15) as r:
                    r.raise_for_status()
                    for chunk in r.iter_content(chunk_size=65536):
                        if chunk:
                            yield chunk
        except Exception as e:
            print("Stream error:", e)
            return

    return Response(stream_with_context(generate()), mimetype='audio/mpeg')

# History record (server-side optional)

# Serve static files
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    # Development server. For production use gunicorn + nginx.
    app.run()
