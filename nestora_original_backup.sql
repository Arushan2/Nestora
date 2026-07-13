-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: nestora
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `analytics_events`
--

DROP TABLE IF EXISTS `analytics_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `analytics_events` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `target_user_id` int(10) unsigned NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `item_id` int(10) unsigned DEFAULT NULL,
  `viewer_id` int(10) unsigned DEFAULT NULL,
  `viewer_ip` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `analytics_events_target_user_id_foreign` (`target_user_id`),
  KEY `analytics_events_viewer_id_foreign` (`viewer_id`),
  CONSTRAINT `analytics_events_target_user_id_foreign` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `analytics_events_viewer_id_foreign` FOREIGN KEY (`viewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `analytics_events`
--

LOCK TABLES `analytics_events` WRITE;
/*!40000 ALTER TABLE `analytics_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `analytics_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_verifications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(190) NOT NULL,
  `code` varchar(6) NOT NULL,
  `purpose` enum('signup','forgot_password') NOT NULL,
  `payload` text DEFAULT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `email_verifications_email_purpose` (`email`,`purpose`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verifications`
--

LOCK TABLES `email_verifications` WRITE;
/*!40000 ALTER TABLE `email_verifications` DISABLE KEYS */;
INSERT INTO `email_verifications` VALUES (5,'romansuthan123+pro@gmail.com','207631','signup','{\"name\":\"ProductS1\",\"password_hash\":\"$2y$10$wX4rjzz5maqs2FVI6PzU\\/uptUx.0yxfsxgDtMdRQrpEYxybA1i6p.\"}','2026-07-13 11:19:24','2026-07-13 11:09:24'),(6,'jsuthan2003+product@gmail.com','943158','signup','{\"name\":\"ProductS1\",\"password_hash\":\"$2y$10$rwEPItpfSEI3GnaH9PLWG.UYZ2FzsOrgFe4cWeoe4fN09CbNeIYOS\"}','2026-07-13 11:20:40','2026-07-13 11:10:40'),(7,'romansuthan123@gmail.com','355856','signup','{\"name\":\"ProductS1\",\"password_hash\":\"$2y$10$HqRrbYPYVvvY\\/YeEDUPi2uFM4MOXs4HsRdQ7Qg0eXo1cqIm\\/GVThi\"}','2026-07-13 11:25:26','2026-07-13 11:15:26');
/*!40000 ALTER TABLE `email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inquiry_followups`
--

DROP TABLE IF EXISTS `inquiry_followups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inquiry_followups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `inquiry_id` int(10) unsigned NOT NULL,
  `sender_id` int(10) unsigned NOT NULL,
  `type` enum('inquiry_created','details_requested','details_replied','offer_sent','correction_requested','offer_accepted','work_completed','completion_confirmed') NOT NULL,
  `content` text DEFAULT NULL,
  `quoted_price` decimal(10,2) DEFAULT NULL,
  `images` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `inquiry_followups_inquiry_id_foreign` (`inquiry_id`),
  KEY `inquiry_followups_sender_id_foreign` (`sender_id`),
  CONSTRAINT `inquiry_followups_inquiry_id_foreign` FOREIGN KEY (`inquiry_id`) REFERENCES `service_inquiries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inquiry_followups_sender_id_foreign` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inquiry_followups`
--

LOCK TABLES `inquiry_followups` WRITE;
/*!40000 ALTER TABLE `inquiry_followups` DISABLE KEYS */;
/*!40000 ALTER TABLE `inquiry_followups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `title` varchar(190) NOT NULL,
  `description` text NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_foreign` (`user_id`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,1,'New Pro Application','OMK Constructions has applied to join as a Service Provider.','/admin',1,'2026-07-13 11:25:22');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `product_id` int(10) unsigned NOT NULL,
  `title` varchar(190) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_product_id_foreign` (`product_id`),
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `product_listings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `order_id` varchar(50) NOT NULL,
  `customer_id` int(10) unsigned NOT NULL,
  `seller_id` int(10) unsigned DEFAULT NULL,
  `delivery_address` text NOT NULL,
  `items_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `shipping_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(10,2) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'PENDING',
  `shipped_at` timestamp NULL DEFAULT NULL,
  `payhere_payment_id` varchar(255) DEFAULT NULL,
  `courier_name` varchar(120) DEFAULT NULL,
  `tracking_number` varchar(120) DEFAULT NULL,
  `seller_note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`order_id`),
  KEY `orders_customer_id_foreign` (`customer_id`),
  KEY `orders_seller_id_foreign` (`seller_id`),
  CONSTRAINT `orders_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_seller_id_foreign` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `portfolios`
--

DROP TABLE IF EXISTS `portfolios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portfolios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `inquiry_id` int(10) unsigned DEFAULT NULL,
  `title` varchar(190) NOT NULL,
  `category` varchar(120) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `images` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `portfolios_user_id_foreign` (`user_id`),
  KEY `portfolios_inquiry_id_foreign` (`inquiry_id`),
  CONSTRAINT `portfolios_inquiry_id_foreign` FOREIGN KEY (`inquiry_id`) REFERENCES `service_inquiries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `portfolios_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `portfolios`
--

LOCK TABLES `portfolios` WRITE;
/*!40000 ALTER TABLE `portfolios` DISABLE KEYS */;
/*!40000 ALTER TABLE `portfolios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pro_applications`
--

DROP TABLE IF EXISTS `pro_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pro_applications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `application_type` enum('service_provider','product_seller') NOT NULL,
  `business_name` varchar(190) NOT NULL,
  `business_email` varchar(190) NOT NULL,
  `business_phone` varchar(60) NOT NULL,
  `business_address` varchar(255) NOT NULL,
  `business_city` varchar(120) NOT NULL,
  `business_description` text NOT NULL,
  `document_type` varchar(120) NOT NULL,
  `document_number` varchar(190) NOT NULL,
  `document_file` varchar(255) NOT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `banner_url` varchar(255) DEFAULT NULL,
  `teams_count` int(10) unsigned NOT NULL DEFAULT 1,
  `selected_plan` varchar(255) DEFAULT NULL,
  `stripe_checkout_url` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `bank_name` varchar(120) DEFAULT NULL,
  `account_holder_name` varchar(190) DEFAULT NULL,
  `account_number` varchar(60) DEFAULT NULL,
  `branch` varchar(120) DEFAULT NULL,
  `review_note` varchar(255) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pro_applications_user_unique` (`user_id`),
  CONSTRAINT `pro_applications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pro_applications`
--

LOCK TABLES `pro_applications` WRITE;
/*!40000 ALTER TABLE `pro_applications` DISABLE KEYS */;
INSERT INTO `pro_applications` VALUES (1,4,'service_provider','OMK Constructions','omk@gmail.com','+94771234567','No.47,BaduluSrigama,Passara Road,Badulla','Badulla','Giving High Quality And Budget Friendly Service','','','https://res.cloudinary.com/ddllnw7jd/image/upload/v1783941922/Home/Nestora/Business-Registration-Form-250x324_mhgqos.png',NULL,NULL,1,'starter',NULL,'pending',NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-13 11:25:22','2026-07-13 11:25:22');
/*!40000 ALTER TABLE `pro_applications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_listings`
--

DROP TABLE IF EXISTS `product_listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_listings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `title` varchar(190) NOT NULL,
  `category` varchar(120) NOT NULL,
  `brand` varchar(190) DEFAULT NULL,
  `description` text NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `unit_type` varchar(50) NOT NULL,
  `shipping_districts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`shipping_districts`)),
  `delivery_terms` varchar(255) DEFAULT NULL,
  `unloading_provided` tinyint(1) NOT NULL DEFAULT 0,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `shipping_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock_units` int(10) unsigned NOT NULL DEFAULT 0,
  `has_expiry_date` tinyint(1) NOT NULL DEFAULT 0,
  `last_stock_checkpoint` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_listings_user_id_foreign` (`user_id`),
  CONSTRAINT `product_listings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_listings`
--

LOCK TABLES `product_listings` WRITE;
/*!40000 ALTER TABLE `product_listings` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_listings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_reviews`
--

DROP TABLE IF EXISTS `product_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_reviews` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `rating` tinyint(3) unsigned NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_reviews_product_id_foreign` (`product_id`),
  KEY `product_reviews_user_id_foreign` (`user_id`),
  CONSTRAINT `product_reviews_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `product_listings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_reviews_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_reviews`
--

LOCK TABLES `product_reviews` WRITE;
/*!40000 ALTER TABLE `product_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_stock_batches`
--

DROP TABLE IF EXISTS `product_stock_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_stock_batches` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` int(10) unsigned NOT NULL,
  `stock_units` int(10) unsigned NOT NULL DEFAULT 0,
  `expiry_date` date DEFAULT NULL,
  `discount_percentage` decimal(5,2) DEFAULT NULL,
  `discount_price` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_stock_batches_product_id_foreign` (`product_id`),
  CONSTRAINT `product_stock_batches_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `product_listings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_stock_batches`
--

LOCK TABLES `product_stock_batches` WRITE;
/*!40000 ALTER TABLE `product_stock_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_stock_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `provider_schedules`
--

DROP TABLE IF EXISTS `provider_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `provider_schedules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `provider_id` int(10) unsigned NOT NULL,
  `event_date` date NOT NULL,
  `type` enum('leave','manual_work') NOT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `google_event_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `provider_schedules_date_type_unique` (`provider_id`,`event_date`,`type`),
  CONSTRAINT `provider_schedules_provider_id_foreign` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `provider_schedules`
--

LOCK TABLES `provider_schedules` WRITE;
/*!40000 ALTER TABLE `provider_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `provider_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `seller_settlements`
--

DROP TABLE IF EXISTS `seller_settlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seller_settlements` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `seller_id` int(10) unsigned NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `receipt_url` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `seller_settlements_seller_id_foreign` (`seller_id`),
  CONSTRAINT `seller_settlements_seller_id_foreign` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `seller_settlements`
--

LOCK TABLES `seller_settlements` WRITE;
/*!40000 ALTER TABLE `seller_settlements` DISABLE KEYS */;
/*!40000 ALTER TABLE `seller_settlements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_inquiries`
--

DROP TABLE IF EXISTS `service_inquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_inquiries` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int(10) unsigned NOT NULL,
  `customer_id` int(10) unsigned NOT NULL,
  `provider_id` int(10) unsigned NOT NULL,
  `status` enum('pending','details_requested','offered','accepted','work_completed','completed') NOT NULL DEFAULT 'pending',
  `survey_plan_url` varchar(255) DEFAULT NULL,
  `booking_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `customer_google_event_id` varchar(255) DEFAULT NULL,
  `provider_google_event_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `service_inquiries_service_id_foreign` (`service_id`),
  KEY `service_inquiries_customer_id_foreign` (`customer_id`),
  KEY `service_inquiries_provider_id_foreign` (`provider_id`),
  CONSTRAINT `service_inquiries_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_inquiries_provider_id_foreign` FOREIGN KEY (`provider_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `service_inquiries_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `service_listings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_inquiries`
--

LOCK TABLES `service_inquiries` WRITE;
/*!40000 ALTER TABLE `service_inquiries` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_inquiries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `service_listings`
--

DROP TABLE IF EXISTS `service_listings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_listings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `title` varchar(190) NOT NULL,
  `category` varchar(120) NOT NULL,
  `description` text NOT NULL,
  `pricing_type` enum('sqft','daily_labor','per_point','linear_ft') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `price_details` varchar(255) DEFAULT NULL,
  `cities` text NOT NULL,
  `images` text DEFAULT NULL,
  `portfolio_ids` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `service_listings_user_id_foreign` (`user_id`),
  CONSTRAINT `service_listings_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `service_listings`
--

LOCK TABLES `service_listings` WRITE;
/*!40000 ALTER TABLE `service_listings` DISABLE KEYS */;
/*!40000 ALTER TABLE `service_listings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('user','admin','service_provider','product_seller') NOT NULL DEFAULT 'user',
  `banned_until` timestamp NULL DEFAULT NULL,
  `ban_reason` varchar(255) DEFAULT NULL,
  `stripe_customer_id` varchar(255) DEFAULT NULL,
  `stripe_subscription_id` varchar(255) DEFAULT NULL,
  `subscription_status` varchar(50) NOT NULL DEFAULT 'inactive',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `google_access_token` text DEFAULT NULL,
  `google_refresh_token` text DEFAULT NULL,
  `google_token_expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'jathusuthan','jsuthan2003+admin@gmail.com','$2y$10$HCsYNhmrgWObTUsFpGfa3OQKcC7hrm4h88SEfcuGZMLZ.hMZKF9MS','admin',NULL,NULL,NULL,NULL,'inactive','2026-07-13 11:03:46',NULL,NULL,NULL),(2,'Customer 1','romansuthan123+customer@gmail.com','$2y$10$kwi4c5djPpVeSQMOfarXReRVftb5W53p.4g8QC/mos6dkR/kOSWi6','user',NULL,NULL,NULL,NULL,'inactive','2026-07-13 11:05:31',NULL,NULL,NULL),(3,'ProductS1','romansuthan123+product@gmail.com','$2y$10$QszcOkC/xsTpytCmBzSjCO5BKZQeaPidviekCBVMwD1YPZgClOeLm','user',NULL,NULL,NULL,NULL,'inactive','2026-07-13 11:18:17',NULL,NULL,NULL),(4,'ServiceP1','romansuthan123+service@gmail.com','$2y$10$4Lmegxytg9lO3QncnNmntOvTbeC.QDu/INyRvFCIpAiaOs5FfiD1S','user',NULL,NULL,NULL,NULL,'inactive','2026-07-13 11:20:45',NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-13 17:44:56
