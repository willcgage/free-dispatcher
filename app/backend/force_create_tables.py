from database import sync_engine, Base

if __name__ == "__main__":
    print("Creating all tables...")
    Base.metadata.create_all(bind=sync_engine)
    print("Done.")
