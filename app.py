import os
from flask import Flask, request, jsonify, send_from_directory, Response, redirect
from ytmusicapi import YTMusic
import yt_dlp
import threading
import time

app = Flask(__name__, static_folder="static", static_url_path="/static")

# Initialize YTMusic
yt = YTMusic()

# Cache for direct URLs to avoid repeated yt-dlp calls
url_cache = {}
cache_lock = threading.Lock()

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# Search endpoint
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

# Trending endpoint
@app.route('/trending')
def trending():
    try:
        results = yt.search("latest punjabi songs", filter="songs", limit=10)
        out = [{"title": r.get("title"),
                "artists": [a.get("name") for a in r.get("artists", [])] if r.get("artists") else [],
                "videoId": r.get("videoId"),
                "thumbnails": r.get("thumbnails", [])} for r in results]
        return jsonify(out)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Recommend endpoint
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

# OPTIMIZED Play endpoint - Returns direct URL instead of streaming
@app.route('/play')
def play():
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({"error": "missing videoId"}), 400
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Check cache first
    with cache_lock:
        if video_id in url_cache:
            cached_url, timestamp = url_cache[video_id]
            # Cache valid for 1 hour
            if time.time() - timestamp < 3600:
                return jsonify({"url": cached_url, "videoId": video_id})
    
    # Extract URL with timeout
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'socket_timeout': 10,
        'extract_flat': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            direct_url = info.get('url')
            
            if direct_url:
                # Cache the URL
                with cache_lock:
                    url_cache[video_id] = (direct_url, time.time())
                
                return jsonify({"url": direct_url, "videoId": video_id})
            else:
                return jsonify({"error": "Could not extract audio URL"}), 500
                
    except Exception as e:
        print(f"Error extracting audio: {e}")
        return jsonify({"error": str(e)}), 500

# Serve static files
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
