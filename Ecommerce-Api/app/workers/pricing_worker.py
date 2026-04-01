import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.db.database import SessionLocal
from app.services.pricing import PricingService

logger = logging.getLogger(__name__)

pricing_service = PricingService()
scheduler = None


def update_prices_job():
    """
    Background job that updates product prices every hour
    """
    try:
        logger.info("Starting scheduled price update job")
        
        db = SessionLocal()
        
        try:
            result = pricing_service.update_all_products_prices(db)
            logger.info(f"Price update job completed: {result}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error in price update job: {str(e)}")


def start_pricing_worker():
    """
    Start the background pricing worker
    """
    global scheduler
    
    try:
        if scheduler is None:
            scheduler = BackgroundScheduler()
            
            # Add job to run every hour
            scheduler.add_job(
                update_prices_job,
                trigger=IntervalTrigger(hours=1),
                id='pricing_update_job',
                name='Update product prices every hour',
                replace_existing=True,
                misfire_grace_time=30  # seconds
            )
            
            scheduler.start()
            logger.info("Pricing worker started - will update prices every 1 hour")
            
        else:
            logger.warning("Pricing worker already running")
            
    except Exception as e:
        logger.error(f"Failed to start pricing worker: {str(e)}")


def stop_pricing_worker():
    """
    Stop the background pricing worker
    """
    global scheduler
    
    try:
        if scheduler and scheduler.running:
            scheduler.shutdown()
            scheduler = None
            logger.info("Pricing worker stopped")
    except Exception as e:
        logger.error(f"Error stopping pricing worker: {str(e)}")


def trigger_price_update_immediately():
    """
    Trigger price update immediately (useful for testing or manual triggers)
    """
    try:
        db = SessionLocal()
        try:
            result = pricing_service.update_all_products_prices(db)
            return result
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error triggering price update: {str(e)}")
        return {"status": "error", "error": str(e)}
