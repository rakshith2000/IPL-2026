import warnings
from flask import Blueprint, jsonify

from .services.toppers import get_stats
from .services.live import (get_matchInfo, get_scoreCard, get_liveScore,
                            get_matchOvers, get_liveSquad, get_liveStrip)

warnings.filterwarnings("ignore")

api = Blueprint('api', __name__)

@api.route('/api/stats')
def api_stats():
    """Return JSON for the stats (used by API)."""
    return jsonify(get_stats())

@api.route('/api/match-<match>/matchInfo')
def api_match_info(match):
    """Return JSON for the match info (used by API)."""
    return jsonify(get_matchInfo(match))

@api.route('/api/match-<match>/scoreCard')
def api_scoreCard(match):
    """Return JSON for the scoreCard (used by API)."""
    return jsonify(get_scoreCard(match))

@api.route('/api/match-<match>/liveScore')
def api_liveScore(match):
    """Return JSON for the scoreCard (used by API)."""
    return jsonify(get_liveScore(match))

@api.route('/api/match-<match>/Overs')
def api_match_overs(match):
    """Return JSON for the match overs (used by API)."""
    return jsonify(get_matchOvers(match))

@api.route('/api/match-<match>/Graphs')
def api_match_graphs(match):
    """Manhattan / worm / phase charts.

    They are drawn from the same ball-by-ball innings feed the overs list
    reads, so this is get_matchOvers under a second name rather than its own
    fetch — one upstream call either way, and the two tabs can never disagree.
    """
    return jsonify(get_matchOvers(match))

@api.route('/api/match-<match>/liveSquad')
def api_liveSquad(match):
    """Return JSON for the liveSquad (used by API)."""
    return jsonify(get_liveSquad(match))

@api.route('/api/match-<match>/liveStrip')
def api_liveStrip(match):
    """Scores + status for one in-progress match, polled by the fixtures list."""
    resp = jsonify(get_liveStrip(match))
    resp.headers['Cache-Control'] = 'no-store'
    return resp