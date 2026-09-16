import logging
from contextlib import contextmanager
import mysql.connector
from mysql.connector import pooling
from app.config import settings

logger = logging.getLogger(__name__)

# Connection Pool
try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name=settings.DB_POOL_NAME,
        pool_size=settings.DB_POOL_SIZE,
        pool_reset_session=True,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        connect_timeout=10,
        autocommit=False
    )
    logger.info("MySQL connection pool initialized successfully.")
except mysql.connector.Error as err:
    logger.error(f"Failed to initialize MySQL connection pool: {err}")
    db_pool = None

@contextmanager
def get_db():
    """
    Context manager that yields a database connection from the pool and ensures it is returned.
    """
    global db_pool
    if db_pool is None:
        # Retry pool initialization
        db_pool = pooling.MySQLConnectionPool(
            pool_name=settings.DB_POOL_NAME,
            pool_size=settings.DB_POOL_SIZE,
            pool_reset_session=True,
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            connect_timeout=10
        )
    
    conn = db_pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()
