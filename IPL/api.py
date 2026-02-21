from datetime import datetime, date, timedelta
from . import db
from .models import User, Pointstable, Fixture, Squad
from .main import get_battingstats, get_bowlingstats, get_matchInfo, get_scoreCard, get_liveScore, get_matchOvers, get_liveSquad
import os, csv, re, pytz, requests, time
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, jsonify, render_template, url_for, redirect, request, flash, Response, json, stream_with_context
from flask_login import login_required, current_user
from sqlalchemy import and_, or_
from sqlalchemy.sql import text
import requests, warnings
from bs4 import BeautifulSoup
from fuzzywuzzy import fuzz, process
from urllib.request import Request, urlopen

warnings.filterwarnings("ignore")

api = Blueprint('api', __name__)

@api.route('/api/battingstats')
def api_battingstats():
    """Return JSON for the batting stats (used by API)."""
    return jsonify(get_battingstats())

@api.route('/api/bowlingstats')
def api_bowlingstats():
    """Return JSON for the bowling stats (used by API)."""
    return jsonify(get_bowlingstats())

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

@api.route('/api/match-<match>/liveSquad')
def api_liveSquad(match):
    """Return JSON for the liveSquad (used by API)."""
    return jsonify(get_liveSquad(match))