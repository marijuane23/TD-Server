import os
import sys
import mysql.connector
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

DB_HOST = os.getenv("DB_HOST", "194.59.164.40")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "u463580331_td_db")
DB_USER = os.getenv("DB_USER", "u463580331_td")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Teachersd4y@2026!")

TEACHERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  photo_url VARCHAR(255),
  photo_data MEDIUMBLOB,
  photo_mime_type VARCHAR(50),
  slug VARCHAR(120) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

MESSAGES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  sender_name VARCHAR(100),
  message_text TEXT NOT NULL,
  media_data LONGBLOB,
  media_mime_type VARCHAR(50),
  media_filename VARCHAR(255),
  media_type ENUM('image', 'video'),
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

SEED_TEACHERS = [
    {
        "name": "Dr. Maria Elena Santos",
        "department": "College of Agriculture and Forestry",
        "slug": "maria-elena-santos",
        "photo_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Prof. Roberto Villanueva",
        "department": "College of Agriculture and Forestry",
        "slug": "roberto-villanueva",
        "photo_url": "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Engr. Anthony Reyes",
        "department": "College of Technology and Allied Sciences",
        "slug": "anthony-reyes",
        "photo_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Prof. Catherine Diaz",
        "department": "College of Technology and Allied Sciences",
        "slug": "catherine-diaz",
        "photo_url": "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Dr. Grace Lim",
        "department": "Department of Teacher Education",
        "slug": "grace-lim",
        "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Prof. Jonathan Fernandez",
        "department": "Department of Teacher Education",
        "slug": "jonathan-fernandez",
        "photo_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Prof. Dennis Alcala",
        "department": "General Education & Arts",
        "slug": "dennis-alcala",
        "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400"
    },
    {
        "name": "Prof. Teresa Ramirez",
        "department": "General Education & Arts",
        "slug": "teresa-ramirez",
        "photo_url": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400"
    }
]

def init_database():
    print(f"Connecting to MySQL database at {DB_HOST}:{DB_PORT} ({DB_NAME})...")
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        cursor = conn.cursor()
        print("Connected successfully!")

        print("Creating table 'teachers'...")
        cursor.execute(TEACHERS_TABLE_SQL)

        print("Creating table 'messages'...")
        cursor.execute(MESSAGES_TABLE_SQL)
        conn.commit()

        # Check existing teachers count
        cursor.execute(" COUNT(*) FROM teachers")
        count = cursor.fetchone()[0]
        print(f"Current teacher count: {count}")

        if count == 0:
            print("Seeding initial faculty records...")
            insert_query = """
            INSERT INTO teachers (name, department, slug, photo_url)
            VALUES (%s, %s, %s, %s)
            """
            for t in SEED_TEACHERS:
                cursor.execute(insert_query, (t["name"], t["department"], t["slug"], t["photo_url"]))
            conn.commit()
            print(f"Seeded {len(SEED_TEACHERS)} faculty members successfully!")

            # Seed a sample approved tribute message for Dr. Maria Elena Santos
            cursor.execute("SELECT id FROM teachers WHERE slug = %s", ("maria-elena-santos",))
            teacher_row = cursor.fetchone()
            if teacher_row:
                teacher_id = teacher_row[0]
                sample_message = (
                    teacher_id,
                    "BS Agriculture Class of 2026",
                    "Thank you Dr. Santos for always guiding us through our fieldwork with unmatched patience and wisdom. Happy Teacher's Day!",
                    None,
                    None,
                    None,
                    None,
                    True
                )
                cursor.execute("""
                INSERT INTO messages (teacher_id, sender_name, message_text, media_data, media_mime_type, media_filename, media_type, approved)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, sample_message)
                conn.commit()
                print("Sample tribute message seeded.")

        cursor.close()
        conn.close()
        print("Database initialization complete!")

    except mysql.connector.Error as err:
        print(f"Database error: {err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    init_database()
