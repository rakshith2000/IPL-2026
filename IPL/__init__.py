from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from werkzeug.security import generate_password_hash, check_password_hash
import os, requests, uuid
from datetime import datetime, timedelta

def add_days(value, days):
    return value + timedelta(days=days)

def eval_str(value):
    return eval(value)

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)

    # Set config from environment variables or defaults
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///IPL.sqlite')

    app.jinja_env.filters['add_days'] = add_days
    app.jinja_env.filters['eval_str'] = eval_str

    db.init_app(app)
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    from .models import User
    #
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(user_id)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint)

    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint)

    with app.app_context():
        db.create_all()

    return app