
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `appointment_gift_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_gift_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `instance_id` int(11) NOT NULL,
  `gift_id` int(11) NOT NULL DEFAULT 0,
  `reward_item_index` int(11) NOT NULL DEFAULT 0,
  `service_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `redeemed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_appt_gift_item` (`tenant_id`,`appointment_id`,`instance_id`,`reward_item_index`,`service_id`),
  KEY `idx_appointment` (`appointment_id`),
  KEY `idx_instance` (`instance_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_appt_gift_location` (`location_id`,`appointment_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_gift_items_tenant_id` BEFORE INSERT ON `appointment_gift_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_giftbox_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_giftbox_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `instance_id` int(11) NOT NULL,
  `giftbox_item_id` int(11) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `redeemed_at` datetime DEFAULT NULL,
  `redemption_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uniq_appt_item` (`tenant_id`,`appointment_id`,`instance_id`,`giftbox_item_id`),
  KEY `idx_appt` (`appointment_id`),
  KEY `idx_instance` (`instance_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_instance_item_redeemed` (`instance_id`,`giftbox_item_id`,`redeemed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_giftbox_items_tenant_id` BEFORE INSERT ON `appointment_giftbox_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_holds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_holds` (
  `tenant_id` int(11) NOT NULL,
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `token` char(64) NOT NULL,
  `channel` varchar(32) NOT NULL,
  `owner_key` varchar(190) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `service_ids_json` text DEFAULT NULL,
  `staff_ids_json` text DEFAULT NULL,
  `cabin_ids_json` text DEFAULT NULL,
  `segments_json` mediumtext DEFAULT NULL,
  `resource_blocks_json` mediumtext DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `appointment_id` int(11) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_appointment_holds_token` (`tenant_id`,`token`),
  KEY `idx_appt_holds_active_range` (`status`,`expires_at`,`starts_at`,`ends_at`),
  KEY `idx_appt_holds_owner` (`channel`,`owner_key`,`status`,`expires_at`),
  KEY `idx_appt_holds_location_range` (`location_id`,`status`,`expires_at`,`starts_at`,`ends_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_holds_tenant_id` BEFORE INSERT ON `appointment_holds` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_locations` (
  `tenant_id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  PRIMARY KEY (`tenant_id`,`appointment_id`,`location_id`),
  KEY `fk_al_loc` (`location_id`),
  KEY `idx_al_loc_appt` (`location_id`,`appointment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_locations_tenant_id` BEFORE INSERT ON `appointment_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_package_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_package_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `client_package_id` int(11) NOT NULL,
  `client_package_service_id` int(11) DEFAULT NULL,
  `service_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `redeemed_at` datetime DEFAULT NULL,
  `usage_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uniq_appt_pkg_item` (`tenant_id`,`appointment_id`,`client_package_id`,`service_id`),
  KEY `idx_appt` (`appointment_id`),
  KEY `idx_pkg` (`client_package_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_pkg_service_redeemed` (`client_package_id`,`service_id`,`redeemed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_package_items_tenant_id` BEFORE INSERT ON `appointment_package_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_prepaid_service_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_prepaid_service_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `client_prepaid_service_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `redeemed_at` datetime DEFAULT NULL,
  `usage_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_appt_prepaid_item` (`tenant_id`,`appointment_id`,`client_prepaid_service_id`,`service_id`),
  KEY `idx_appt` (`appointment_id`),
  KEY `idx_prepaid` (`client_prepaid_service_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_prepaid_service_redeemed` (`client_prepaid_service_id`,`service_id`,`redeemed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_prepaid_service_items_tenant_id` BEFORE INSERT ON `appointment_prepaid_service_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_segments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_segments` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `service_name` varchar(190) DEFAULT NULL,
  `staff_id` int(11) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `duration_minutes` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `cabin_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_appt` (`appointment_id`),
  KEY `idx_staff_time` (`staff_id`,`starts_at`,`ends_at`),
  KEY `idx_service` (`service_id`),
  KEY `idx_cabin_time` (`cabin_id`,`starts_at`,`ends_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_segments_tenant_id` BEFORE INSERT ON `appointment_segments` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_services` (
  `tenant_id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `service_name` varchar(190) DEFAULT NULL,
  `service_category_id` int(11) DEFAULT NULL,
  `service_category_name` varchar(190) DEFAULT NULL,
  `service_snapshot_json` longtext DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `list_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_badge` varchar(32) DEFAULT NULL,
  `duration_min` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`appointment_id`,`service_id`),
  KEY `idx_aps_service` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_services_tenant_id` BEFORE INSERT ON `appointment_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointment_staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_staff` (
  `tenant_id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  PRIMARY KEY (`tenant_id`,`appointment_id`,`staff_id`),
  KEY `fk_as_staff` (`staff_id`),
  KEY `idx_as_staff_appt` (`staff_id`,`appointment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointment_staff_tenant_id` BEFORE INSERT ON `appointment_staff` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointments` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `public_code` varchar(16) DEFAULT NULL,
  `client_id` int(11) NOT NULL,
  `fidelity_card_id` int(11) DEFAULT NULL,
  `fidelity_card_code` varchar(20) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `cabin_id` int(11) DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `discount_type` enum('percent','fixed') DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','scheduled','done','canceled','no_show') NOT NULL DEFAULT 'scheduled',
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `staff_notes` text DEFAULT NULL,
  `customer_notes` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `fidelity_points_used` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `fidelity_points_earned` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_campaign_id` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `promotion_conditions` text DEFAULT NULL,
  `credit_used` decimal(10,2) NOT NULL DEFAULT 0.00,
  `giftcard_id` int(11) DEFAULT NULL,
  `giftcard_used` decimal(10,2) NOT NULL DEFAULT 0.00,
  `fidelity_gift_points_used` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_gift_idx` int(11) DEFAULT NULL,
  `fidelity_conflict_choice` varchar(20) DEFAULT NULL,
  `credit_used_by_customer` tinyint(1) NOT NULL DEFAULT 0,
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_appt_public_code` (`tenant_id`,`public_code`),
  KEY `fk_appt_service` (`service_id`),
  KEY `idx_appt_starts` (`starts_at`),
  KEY `idx_appt_ends` (`ends_at`),
  KEY `idx_appt_client` (`client_id`),
  KEY `idx_appt_status` (`status`),
  KEY `idx_appt_cabin` (`cabin_id`),
  KEY `idx_giftcard_id` (`giftcard_id`),
  KEY `idx_appointments_fidelity_campaign_id` (`fidelity_campaign_id`),
  KEY `idx_fidelity_card_id` (`fidelity_card_id`),
  KEY `idx_fidelity_card_code` (`fidelity_card_code`),
  KEY `idx_appointments_location_time` (`location_id`,`starts_at`,`ends_at`),
  KEY `idx_appointments_client_credit_status` (`client_id`,`credit_used`,`status`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_appointments_tenant_id` BEFORE INSERT ON `appointments` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `automation_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `automation_settings` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reminder_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `reminder_hours` int(11) NOT NULL DEFAULT 24,
  `approved_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `approved_subject` varchar(190) NOT NULL,
  `approved_body` text NOT NULL,
  `modified_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `modified_subject` varchar(190) NOT NULL DEFAULT 'Appuntamento modificato',
  `modified_body` text DEFAULT NULL,
  `rejected_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `rejected_subject` varchar(190) NOT NULL,
  `rejected_body` text NOT NULL,
  `reminder_subject` varchar(190) NOT NULL,
  `reminder_body` text NOT NULL,
  `sms_reminder_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `sms_reminder_hours` int(11) NOT NULL DEFAULT 24,
  `sms_reminder_sender` varchar(11) NOT NULL DEFAULT 'Prenodo',
  `sms_reminder_body` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fidelity_expiry_reminder_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `fidelity_expiry_reminder_subject` varchar(190) NOT NULL DEFAULT 'La tua tessera Fidelity sta per scadere',
  `fidelity_expiry_reminder_body` text DEFAULT NULL,
  `installment_alert_days` int(11) NOT NULL DEFAULT 7,
  `client_birthday_alert_days` int(11) NOT NULL DEFAULT 7,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_automation_settings_tenant_id` BEFORE INSERT ON `automation_settings` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `booking_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `booking_users` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) DEFAULT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(120) DEFAULT NULL,
  `last_name` varchar(120) DEFAULT NULL,
  `full_name` varchar(190) DEFAULT NULL,
  `phone` varchar(60) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login_at` datetime DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `email_verification_hash` char(64) DEFAULT NULL,
  `email_verification_expires_at` datetime DEFAULT NULL,
  `email_verification_sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_booking_users_email` (`tenant_id`,`email`),
  KEY `idx_booking_users_client` (`client_id`),
  KEY `idx_booking_users_evexp` (`email_verification_expires_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_booking_users_tenant_id` BEFORE INSERT ON `booking_users` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `business_gallery_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `business_gallery_images` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `business_id` int(11) DEFAULT NULL,
  `path` varchar(255) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_business_gallery_sort` (`business_id`,`is_active`,`sort_order`,`id`),
  KEY `idx_business_gallery_order` (`sort_order`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_business_gallery_images_tenant_id` BEFORE INSERT ON `business_gallery_images` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `business_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `business_hours` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) DEFAULT NULL,
  `dow` tinyint(4) NOT NULL,
  `opens` time DEFAULT NULL,
  `closes` time DEFAULT NULL,
  `opens2` time DEFAULT NULL,
  `closes2` time DEFAULT NULL,
  `is_closed` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_hours` (`tenant_id`,`location_id`,`dow`),
  KEY `idx_business_hours_location_dow` (`location_id`,`dow`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=211 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_business_hours_tenant_id` BEFORE INSERT ON `business_hours` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `business_hours_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `business_hours_exceptions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) DEFAULT NULL,
  `date` date NOT NULL,
  `opens` time DEFAULT NULL,
  `closes` time DEFAULT NULL,
  `opens2` time DEFAULT NULL,
  `closes2` time DEFAULT NULL,
  `is_closed` tinyint(1) NOT NULL DEFAULT 0,
  `note` varchar(190) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `location_id_norm` int(11) GENERATED ALWAYS AS (ifnull(`location_id`,0)) STORED,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_date` (`tenant_id`,`location_id_norm`,`date`),
  KEY `idx_date` (`date`),
  KEY `idx_location` (`location_id`),
  KEY `idx_bhe_location_date` (`location_id`,`date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_business_hours_exceptions_tenant_id` BEFORE INSERT ON `business_hours_exceptions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `businesses` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `booking_about_text` longtext DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `website` varchar(190) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `booking_choose_staff_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `quote_company_name` varchar(255) DEFAULT NULL,
  `quote_vat_number` varchar(40) DEFAULT NULL,
  `quote_tax_code` varchar(40) DEFAULT NULL,
  `quote_sdi` varchar(40) DEFAULT NULL,
  `quote_pec` varchar(190) DEFAULT NULL,
  `quote_address` varchar(255) DEFAULT NULL,
  `quote_cap` varchar(20) DEFAULT NULL,
  `quote_city` varchar(190) DEFAULT NULL,
  `quote_province` varchar(190) DEFAULT NULL,
  `quote_region` varchar(190) DEFAULT NULL,
  `quote_phone` varchar(40) DEFAULT NULL,
  `quote_email` varchar(190) DEFAULT NULL,
  `quote_website` varchar(190) DEFAULT NULL,
  `quote_footer` text DEFAULT NULL,
  `quote_terms` text DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `cover_path` varchar(255) DEFAULT NULL,
  `payment_methods` text DEFAULT NULL,
  `booking_products_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `logo_blob` mediumblob DEFAULT NULL,
  `logo_mime` varchar(50) DEFAULT NULL,
  `logo_updated_at` datetime DEFAULT NULL,
  `booking_customer_cancel_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `booking_customer_cancel_before_value` int(11) NOT NULL DEFAULT 0,
  `booking_customer_cancel_before_unit` varchar(10) NOT NULL DEFAULT 'hours',
  `fidelity_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `fidelity_points_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `fidelity_points_label` varchar(30) NOT NULL DEFAULT 'Punti',
  `fidelity_earn_mode` varchar(20) NOT NULL DEFAULT 'amount',
  `fidelity_earn_step_euro` decimal(10,2) NOT NULL DEFAULT 10.00,
  `fidelity_earn_points_per_appointment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_redeem_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `fidelity_redeem_euro_per_point` decimal(10,2) NOT NULL DEFAULT 0.10,
  `fidelity_redeem_min_points` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_gifts_json` text DEFAULT NULL,
  `fidelity_earn_on_appointment_done` tinyint(1) NOT NULL DEFAULT 1,
  `fidelity_expire_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `fidelity_expire_days` int(11) NOT NULL DEFAULT 365,
  `fidelity_levels_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `fidelity_card_levels_json` text DEFAULT NULL,
  `fidelity_silver_threshold` int(11) NOT NULL DEFAULT 200,
  `fidelity_gold_threshold` int(11) NOT NULL DEFAULT 500,
  `fidelity_level_period_days` int(11) NOT NULL DEFAULT 365,
  `fidelity_expire_warn_days` int(11) NOT NULL DEFAULT 30,
  `fidelity_redeem_auto_discount_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `fidelity_adhesion_json` text DEFAULT NULL,
  `giftcard_default_validity_value` int(11) NOT NULL DEFAULT 0,
  `giftcard_default_validity_unit` varchar(10) NOT NULL DEFAULT 'days',
  `giftbox_default_validity_value` int(11) NOT NULL DEFAULT 0,
  `giftbox_default_validity_unit` varchar(10) NOT NULL DEFAULT 'days',
  `giftbox_terms` text DEFAULT NULL,
  `gdpr_template_body` longtext DEFAULT NULL,
  `fidelity_gift_terms` text DEFAULT NULL,
  `site_region` varchar(190) DEFAULT NULL,
  `site_province` varchar(190) DEFAULT NULL,
  `site_city` varchar(190) DEFAULT NULL,
  `site_cap` varchar(20) DEFAULT NULL,
  `site_address` varchar(255) DEFAULT NULL,
  `giftcard_terms` text DEFAULT NULL,
  `logo_position_x` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `logo_position_y` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `cover_position_x` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `cover_position_y` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `package_default_validity_value` int(11) NOT NULL DEFAULT 0,
  `package_default_validity_unit` varchar(10) NOT NULL DEFAULT 'days',
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_businesses_tenant_id` BEFORE INSERT ON `businesses` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `cabins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cabins` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_position` (`position`),
  KEY `idx_active` (`is_active`),
  KEY `idx_cabins_location_active` (`location_id`,`is_active`,`position`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_cabins_tenant_id` BEFORE INSERT ON `cabins` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `calendar_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `calendar_notes` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note_date` date NOT NULL,
  `title` varchar(190) DEFAULT NULL,
  `note_text` text NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_note_date` (`note_date`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_calendar_notes_tenant_id` BEFORE INSERT ON `calendar_notes` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `card_code_registry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `card_code_registry` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `normalized_code` varchar(20) NOT NULL,
  `card_id` int(11) DEFAULT NULL,
  `client_id` int(11) DEFAULT NULL,
  `first_seen_at` datetime NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime DEFAULT NULL,
  `source` varchar(40) NOT NULL DEFAULT 'runtime',
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uk_card_code_registry_norm` (`tenant_id`,`normalized_code`),
  KEY `idx_card_code_registry_code` (`code`),
  KEY `idx_card_code_registry_client` (`client_id`),
  KEY `idx_card_code_registry_card` (`card_id`),
  KEY `idx_card_code_registry_source` (`source`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_card_code_registry_tenant_id` BEFORE INSERT ON `card_code_registry` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `card_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `card_reminders` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `card_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `reminder_kind` varchar(40) NOT NULL DEFAULT 'expiry_window',
  `card_expires_at` date NOT NULL,
  `scheduled_at` datetime NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `last_error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_status_scheduled` (`status`,`scheduled_at`),
  KEY `idx_card_kind` (`card_id`,`reminder_kind`),
  KEY `idx_client` (`client_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_card_reminders_tenant_id` BEFORE INSERT ON `card_reminders` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `cards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cards` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `client_id` int(11) NOT NULL,
  `issued_at` date NOT NULL,
  `expires_at` date DEFAULT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'active',
  `credit` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uk_cards_client` (`tenant_id`,`client_id`),
  UNIQUE KEY `uk_cards_code` (`tenant_id`,`code`),
  KEY `idx_tenant_local_id` (`id`),
  KEY `idx_cards_status_exp` (`status`,`expires_at`),
  KEY `idx_cards_client_status` (`client_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_cards_tenant_id` BEFORE INSERT ON `cards` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_consent_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_consent_records` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `document_id` int(11) DEFAULT NULL,
  `snapshot_json` longtext DEFAULT NULL,
  `public_token` char(64) DEFAULT NULL,
  `signature_requested_at` datetime DEFAULT NULL,
  `signed_at` datetime DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_client_module` (`tenant_id`,`client_id`,`module_id`),
  UNIQUE KEY `uq_public_token` (`tenant_id`,`public_token`),
  KEY `idx_module` (`module_id`),
  KEY `idx_status` (`status`),
  KEY `idx_document` (`document_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_consent_records_tenant_id` BEFORE INSERT ON `client_consent_records` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_deletion_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_deletion_logs` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_ids` text DEFAULT NULL,
  `client_names` text DEFAULT NULL,
  `deleted_count` int(11) NOT NULL DEFAULT 0,
  `stock_restore_mode` varchar(30) NOT NULL DEFAULT 'no_restore',
  `reason` text DEFAULT NULL,
  `summary_json` longtext DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_deleted_by` (`deleted_by`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_deletion_logs_tenant_id` BEFORE INSERT ON `client_deletion_logs` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_package_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_package_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_package_id` int(11) NOT NULL,
  `item_type` varchar(20) NOT NULL DEFAULT 'service',
  `item_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_type` varchar(20) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `item_name_snapshot` varchar(190) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client_package` (`client_package_id`),
  KEY `idx_item` (`item_type`,`item_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_package_items_tenant_id` BEFORE INSERT ON `client_package_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_package_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_package_services` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_package_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `sessions_total` int(11) NOT NULL DEFAULT 1,
  `sessions_remaining` int(11) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `service_snapshot_json` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client_package` (`client_package_id`),
  KEY `idx_service` (`service_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_package_services_tenant_id` BEFORE INSERT ON `client_package_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_package_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_package_transactions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_package_id` int(11) NOT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'adjust',
  `amount` int(11) NOT NULL DEFAULT 0,
  `item_type` varchar(20) DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_package_created` (`client_package_id`,`created_at`),
  KEY `idx_appointment` (`appointment_id`),
  KEY `idx_item` (`client_package_id`,`item_type`,`item_id`),
  KEY `idx_type` (`type`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_package_transactions_tenant_id` BEFORE INSERT ON `client_package_transactions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_package_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_package_usages` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_package_id` int(11) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `used_at` datetime NOT NULL,
  `delta` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `item_type` varchar(20) DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_cpu_pkg` (`client_package_id`),
  KEY `idx_cpu_usedat` (`used_at`),
  KEY `idx_cpu_appt` (`appointment_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_client_package_usages_location` (`location_id`,`used_at`),
  KEY `idx_tenant_local_id` (`id`),
  KEY `idx_client_package_item` (`client_package_id`,`item_type`,`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_package_usages_tenant_id` BEFORE INSERT ON `client_package_usages` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_packages` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `package_id` int(11) DEFAULT NULL,
  `package_name` varchar(190) NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `expires_at` date DEFAULT NULL,
  `sessions_total` int(11) NOT NULL DEFAULT 1,
  `sessions_remaining` int(11) NOT NULL DEFAULT 1,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `source_quote_id` int(11) DEFAULT NULL,
  `source_quote_item_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `sale_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_cp_source_quote_item` (`tenant_id`,`source_quote_item_id`),
  KEY `idx_cp_client` (`client_id`),
  KEY `idx_cp_status` (`status`),
  KEY `idx_cp_expires` (`expires_at`),
  KEY `idx_cp_client_status` (`client_id`,`status`),
  KEY `idx_cp_source_quote` (`source_quote_id`),
  KEY `idx_client_packages_location_status` (`location_id`,`status`),
  KEY `idx_client_packages_sale` (`sale_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_packages_tenant_id` BEFORE INSERT ON `client_packages` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_prepaid_service_usages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_prepaid_service_usages` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_prepaid_service_id` int(11) NOT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `used_at` datetime NOT NULL DEFAULT current_timestamp(),
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_prepaid` (`client_prepaid_service_id`),
  KEY `idx_appointment` (`appointment_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_prepaid_service_usages_tenant_id` BEFORE INSERT ON `client_prepaid_service_usages` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_prepaid_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_prepaid_services` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `sale_id` int(11) DEFAULT NULL,
  `sale_item_id` int(11) DEFAULT NULL,
  `service_id` int(11) NOT NULL,
  `service_name` varchar(190) NOT NULL DEFAULT '',
  `purchased_qty` int(11) NOT NULL DEFAULT 1,
  `remaining_qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `service_snapshot_json` longtext DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `purchase_date` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `canceled_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_sale_item_id` (`tenant_id`,`sale_item_id`),
  KEY `idx_client_status` (`client_id`,`status`),
  KEY `idx_sale` (`sale_id`),
  KEY `idx_service` (`service_id`),
  KEY `idx_prepaid_expires_at` (`expires_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_prepaid_services_tenant_id` BEFORE INSERT ON `client_prepaid_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_sheet_presets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_sheet_presets` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `slug` varchar(190) NOT NULL,
  `category` varchar(120) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `fields_json` longtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_client_sheet_presets_slug` (`tenant_id`,`slug`),
  KEY `idx_client_sheet_presets_id` (`id`),
  KEY `idx_client_sheet_presets_active_sort` (`tenant_id`,`is_active`,`sort_order`,`name`),
  KEY `idx_client_sheet_presets_category` (`tenant_id`,`category`,`is_active`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_sheet_presets_tenant_id` BEFORE INSERT ON `client_sheet_presets` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_sheet_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_sheet_records` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `template_id` int(11) NOT NULL,
  `location_id` int(11) DEFAULT NULL,
  `title` varchar(190) NOT NULL,
  `session_date` date NOT NULL,
  `next_session_date` date DEFAULT NULL,
  `operator_name` varchar(120) DEFAULT NULL,
  `values_json` longtext DEFAULT NULL,
  `fields_snapshot_json` longtext DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client_template_date` (`client_id`,`template_id`,`session_date`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_client_template_location_date` (`client_id`,`template_id`,`location_id`,`session_date`),
  KEY `idx_client_sheet_records_location` (`location_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_sheet_records_tenant_id` BEFORE INSERT ON `client_sheet_records` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_sheet_template_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_sheet_template_locations` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `enabled_at` datetime DEFAULT current_timestamp(),
  `disabled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_template_location` (`tenant_id`,`template_id`,`location_id`),
  KEY `idx_location_enabled_sort` (`location_id`,`is_enabled`,`sort_order`),
  KEY `idx_template_enabled` (`template_id`,`is_enabled`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_sheet_template_locations_tenant_id` BEFORE INSERT ON `client_sheet_template_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `client_sheet_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `client_sheet_templates` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `title` varchar(190) NOT NULL,
  `slug` varchar(190) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `fields_json` longtext DEFAULT NULL,
  `parent_template_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client_active` (`client_id`,`is_active`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_client_sheet_templates_slug` (`slug`),
  KEY `idx_client_sheet_templates_deleted` (`deleted_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_client_sheet_templates_tenant_id` BEFORE INSERT ON `client_sheet_templates` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clients` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(190) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `vat_number` varchar(40) DEFAULT NULL,
  `tax_code` varchar(40) DEFAULT NULL,
  `sdi` varchar(40) DEFAULT NULL,
  `pec` varchar(190) DEFAULT NULL,
  `first_name` varchar(120) DEFAULT NULL,
  `last_name` varchar(120) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `phone_home` varchar(40) DEFAULT NULL,
  `phone2` varchar(40) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `gender` enum('M','F') DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `birth_place` varchar(190) DEFAULT NULL,
  `registration_date` date DEFAULT NULL,
  `region` varchar(190) DEFAULT NULL,
  `province` varchar(190) DEFAULT NULL,
  `city` varchar(190) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `cap` varchar(20) DEFAULT NULL,
  `job_title` varchar(190) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `points` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `fidelity_level` varchar(20) DEFAULT NULL,
  `gdpr_status` varchar(20) NOT NULL DEFAULT 'draft',
  `gdpr_consent_data_processing` tinyint(1) NOT NULL DEFAULT 0,
  `gdpr_consent_communications` tinyint(1) NOT NULL DEFAULT 0,
  `gdpr_consent_marketing` tinyint(1) NOT NULL DEFAULT 0,
  `gdpr_consent_data_sharing` tinyint(1) NOT NULL DEFAULT 0,
  `gdpr_document_id` int(11) DEFAULT NULL,
  `gdpr_snapshot_json` longtext DEFAULT NULL,
  `gdpr_public_token` char(64) DEFAULT NULL,
  `gdpr_signature_requested_at` datetime DEFAULT NULL,
  `gdpr_signed_at` datetime DEFAULT NULL,
  `gdpr_locked_at` datetime DEFAULT NULL,
  `credit_balance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `blocked_at` datetime DEFAULT NULL,
  `blocked_internal_note` text DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_clients_full_name` (`full_name`),
  KEY `idx_clients_email` (`email`),
  KEY `idx_clients_phone` (`phone`),
  KEY `idx_gdpr_status` (`gdpr_status`),
  KEY `idx_gdpr_document` (`gdpr_document_id`),
  KEY `idx_gdpr_token` (`gdpr_public_token`),
  KEY `idx_client_is_blocked` (`is_blocked`),
  KEY `idx_clients_location_created` (`location_id`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_clients_tenant_id` BEFORE INSERT ON `clients` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `closures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `closures` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) DEFAULT NULL,
  `date` date NOT NULL,
  `reason` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_closure` (`tenant_id`,`location_id`,`date`),
  KEY `idx_closures_location_date` (`location_id`,`date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_closures_tenant_id` BEFORE INSERT ON `closures` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `communication_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `communication_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `channel` enum('email','sms','whatsapp') NOT NULL DEFAULT 'email',
  `kind` varchar(60) NOT NULL,
  `status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'sent',
  `reference_type` varchar(40) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `recipient` varchar(190) DEFAULT NULL,
  `subject` varchar(190) DEFAULT NULL,
  `provider` varchar(40) DEFAULT NULL,
  `provider_message_id` varchar(120) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_comm_channel_status` (`channel`,`status`,`created_at`),
  KEY `idx_comm_kind` (`kind`,`created_at`),
  KEY `idx_comm_reference` (`reference_type`,`reference_id`),
  KEY `idx_comm_sent_at` (`sent_at`),
  KEY `idx_comm_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `consent_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `consent_modules` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `system_key` varchar(60) DEFAULT NULL,
  `slug` varchar(120) NOT NULL,
  `name` varchar(190) NOT NULL,
  `type` varchar(40) NOT NULL DEFAULT 'informed_consent',
  `body_template` longtext DEFAULT NULL,
  `footer_mode` varchar(40) NOT NULL DEFAULT 'signature_only',
  `footer_title` varchar(190) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_slug` (`tenant_id`,`slug`),
  UNIQUE KEY `uq_system_key` (`tenant_id`,`system_key`),
  KEY `idx_type` (`type`),
  KEY `idx_active_sort` (`is_active`,`sort_order`,`name`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_consent_modules_tenant_id` BEFORE INSERT ON `consent_modules` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `cost_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cost_categories` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `color` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_name` (`name`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_cost_categories_tenant_id` BEFORE INSERT ON `cost_categories` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `costs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `costs` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(190) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `vat_percent` decimal(5,2) DEFAULT NULL,
  `due_date` date NOT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT 0,
  `paid_at` datetime DEFAULT NULL,
  `payment_method` varchar(60) DEFAULT NULL,
  `doc_number` varchar(80) DEFAULT NULL,
  `doc_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_recurring` tinyint(1) NOT NULL DEFAULT 0,
  `recurrence_interval` int(11) NOT NULL DEFAULT 1,
  `recurrence_unit` enum('day','week','month','year') NOT NULL DEFAULT 'month',
  `recurrence_end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_mime` varchar(80) DEFAULT NULL,
  `attachment_name` varchar(190) DEFAULT NULL,
  `attachment_size` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_due` (`due_date`),
  KEY `idx_paid` (`is_paid`),
  KEY `idx_cat` (`category_id`),
  KEY `idx_supplier` (`supplier_id`),
  KEY `idx_costs_location_due_paid` (`location_id`,`due_date`,`is_paid`),
  KEY `idx_location_due_paid` (`location_id`,`due_date`,`is_paid`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_costs_tenant_id` BEFORE INSERT ON `costs` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `coupon_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupon_locations` (
  `tenant_id` int(11) NOT NULL,
  `coupon_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`coupon_id`,`location_id`),
  KEY `idx_coupon_locations_location` (`location_id`),
  KEY `idx_coupon_locations_coupon` (`coupon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_coupon_locations_tenant_id` BEFORE INSERT ON `coupon_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `coupons` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(40) NOT NULL,
  `description` varchar(190) DEFAULT NULL,
  `discount_type` enum('percent','fixed') NOT NULL DEFAULT 'percent',
  `discount_value` decimal(10,2) NOT NULL DEFAULT 10.00,
  `min_subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `apply_scope` varchar(30) NOT NULL DEFAULT 'all',
  `service_category_ids_json` text DEFAULT NULL,
  `service_ids_json` text DEFAULT NULL,
  `product_ids_json` text DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `usage_limit` int(11) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_reason` varchar(255) DEFAULT NULL,
  `product_category_ids_json` text DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `code` (`tenant_id`,`code`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_coupons_tenant_id` BEFORE INSERT ON `coupons` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `credit_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `credit_adjustments` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `card_id` int(11) DEFAULT NULL,
  `card_code` varchar(40) DEFAULT NULL,
  `direction` enum('debit','credit') NOT NULL DEFAULT 'debit',
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `delta_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `balance_before` decimal(10,2) NOT NULL DEFAULT 0.00,
  `balance_after` decimal(10,2) NOT NULL DEFAULT 0.00,
  `note` varchar(255) NOT NULL DEFAULT '',
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_credit_adjustments_client_created` (`client_id`,`created_at`),
  KEY `idx_credit_adjustments_location_created` (`location_id`,`created_at`),
  KEY `idx_credit_adjustments_created` (`created_at`),
  KEY `idx_credit_adjustments_created_by` (`created_by`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_credit_adjustments_tenant_id` BEFORE INSERT ON `credit_adjustments` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `customer_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_documents` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `title` varchar(190) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `mime` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_doc_client` (`client_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_customer_documents_tenant_id` BEFORE INSERT ON `customer_documents` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `customer_tag_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_tag_map` (
  `tenant_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL,
  PRIMARY KEY (`tenant_id`,`client_id`,`tag_id`),
  KEY `fk_ctm_tag` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_customer_tag_map_tenant_id` BEFORE INSERT ON `customer_tag_map` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `customer_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_tags` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `name` (`tenant_id`,`name`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_customer_tags_tenant_id` BEFORE INSERT ON `customer_tags` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `events` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `event_type` varchar(40) NOT NULL,
  `source_type` varchar(20) NOT NULL,
  `source_id` int(11) NOT NULL,
  `source_line_id` int(11) NOT NULL DEFAULT 0,
  `occurred_at` datetime NOT NULL,
  `service_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_valid` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_fid_events_src` (`tenant_id`,`event_type`,`source_type`,`source_id`,`source_line_id`),
  KEY `idx_fid_events_client_time` (`client_id`,`occurred_at`),
  KEY `idx_fid_events_service` (`service_id`,`occurred_at`),
  KEY `idx_fid_events_product` (`product_id`,`occurred_at`),
  KEY `idx_events_location_date` (`location_id`,`occurred_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_events_tenant_id` BEFORE INSERT ON `events` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `fidelity_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fidelity_campaigns` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL DEFAULT 'Campagna punti',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `starts_at` date DEFAULT NULL,
  `ends_at` date DEFAULT NULL,
  `earn_mode` varchar(20) NOT NULL DEFAULT 'amount',
  `earn_step_euro` decimal(10,2) NOT NULL DEFAULT 10.00,
  `earn_tiers` text DEFAULT NULL,
  `item_rules` longtext DEFAULT NULL,
  `eligible_points_levels` text DEFAULT NULL,
  `min_spend` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_reason` varchar(255) DEFAULT NULL,
  `auto_disabled_by_points` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_fid_campaign_active_dates` (`active`,`starts_at`,`ends_at`),
  KEY `idx_fid_campaign_deleted_at` (`deleted_at`),
  KEY `idx_fid_campaign_auto_disabled_by_points` (`auto_disabled_by_points`,`active`),
  KEY `idx_fidelity_campaigns_deleted_at` (`deleted_at`),
  KEY `idx_fidelity_campaigns_active_period` (`active`,`starts_at`,`ends_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_fidelity_campaigns_tenant_id` BEFORE INSERT ON `fidelity_campaigns` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_instances` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucher_public_token` char(64) DEFAULT NULL,
  `gift_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `state` varchar(20) NOT NULL DEFAULT 'accumulo',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `unlocked_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `redeemed_at` datetime DEFAULT NULL,
  `redeemed_source_type` varchar(30) DEFAULT NULL,
  `redeemed_source_id` int(11) DEFAULT NULL,
  `points_spent` decimal(12,2) NOT NULL DEFAULT 0.00,
  `progress_json` text DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `internal_note` text DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_email_sent_at` datetime DEFAULT NULL,
  `last_email_sent_to` varchar(190) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_gift_instances_voucher_public_token` (`tenant_id`,`voucher_public_token`),
  KEY `idx_fid_gift_instances_client` (`client_id`),
  KEY `idx_fid_gift_instances_gift` (`gift_id`),
  KEY `idx_fid_gift_instances_client_gift_active` (`client_id`,`gift_id`,`is_active`),
  KEY `idx_fid_gift_instances_state` (`state`),
  KEY `idx_gift_instances_location_state` (`location_id`,`state`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_instances_tenant_id` BEFORE INSERT ON `gift_instances` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_locations` (
  `tenant_id` int(11) NOT NULL,
  `gift_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`gift_id`,`location_id`),
  KEY `idx_gift_locations_location` (`location_id`),
  KEY `idx_gift_locations_gift` (`gift_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_locations_tenant_id` BEFORE INSERT ON `gift_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_progress_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_progress_resets` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gift_id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `source_instance_id` int(11) DEFAULT NULL,
  `source_state` varchar(40) DEFAULT NULL,
  `reset_at` datetime NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client_gift_reset` (`client_id`,`gift_id`,`reset_at`),
  KEY `idx_gift_reset` (`gift_id`,`reset_at`),
  KEY `idx_source_instance` (`source_instance_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_progress_resets_tenant_id` BEFORE INSERT ON `gift_progress_resets` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_rule_sets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_rule_sets` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gift_id` int(11) NOT NULL,
  `set_operator` varchar(10) NOT NULL DEFAULT 'and',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_fid_gift_rule_sets_gift` (`gift_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_rule_sets_tenant_id` BEFORE INSERT ON `gift_rule_sets` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_rules` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rule_set_id` int(11) NOT NULL,
  `rule_type` varchar(40) NOT NULL,
  `comparator` varchar(4) NOT NULL DEFAULT '>=',
  `threshold` decimal(12,2) NOT NULL DEFAULT 0.00,
  `target_service_id` int(11) DEFAULT NULL,
  `target_product_id` int(11) DEFAULT NULL,
  `target_level_key` varchar(64) DEFAULT NULL,
  `window_type` varchar(20) NOT NULL DEFAULT 'all_time',
  `window_days` int(11) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_fid_gift_rules_set` (`rule_set_id`),
  KEY `idx_fid_gift_rules_type` (`rule_type`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_rules_tenant_id` BEFORE INSERT ON `gift_rules` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gift_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gift_transactions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `reward_item_index` int(11) DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `type` varchar(30) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_instance` (`instance_id`),
  KEY `idx_appointment` (`appointment_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_gift_transactions_location_created` (`location_id`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gift_transactions_tenant_id` BEFORE INSERT ON `gift_transactions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_instance_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_instance_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `giftbox_item_id` int(11) NOT NULL,
  `item_type` varchar(20) NOT NULL DEFAULT 'service',
  `service_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `custom_label` varchar(255) DEFAULT NULL,
  `custom_details` text DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `service_snapshot_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uniq_instance_item` (`tenant_id`,`instance_id`,`giftbox_item_id`),
  UNIQUE KEY `uq_instance_item` (`tenant_id`,`instance_id`,`giftbox_item_id`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_giftbox_item_id` (`giftbox_item_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_instance` (`instance_id`),
  KEY `idx_giftbox_item` (`giftbox_item_id`),
  KEY `idx_service` (`service_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_instance_items_tenant_id` BEFORE INSERT ON `giftbox_instance_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_instances` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucher_public_token` char(64) DEFAULT NULL,
  `giftbox_id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `recipient_client_id` int(11) DEFAULT NULL,
  `recipient_name` varchar(120) DEFAULT NULL,
  `recipient_email` varchar(190) DEFAULT NULL,
  `status` enum('issued','redeemed','cancelled','expired') NOT NULL DEFAULT 'issued',
  `issued_at` datetime NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `redeemed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `points_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_by` int(11) DEFAULT NULL,
  `redeemed_by` int(11) DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `redeemed_source_type` varchar(30) DEFAULT NULL,
  `redeemed_source_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `event_type` varchar(40) NOT NULL DEFAULT 'giftbox',
  `voucher_hide_amount` tinyint(1) NOT NULL DEFAULT 0,
  `gift_message` text DEFAULT NULL,
  `last_email_sent_at` datetime DEFAULT NULL,
  `last_email_sent_to` varchar(190) DEFAULT NULL,
  `last_email_hide_details` tinyint(1) NOT NULL DEFAULT 0,
  `scheduled_send_on` date DEFAULT NULL,
  `email_show_details` tinyint(1) NOT NULL DEFAULT 1,
  `internal_note` text DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `email_send_claimed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uk_code` (`tenant_id`,`code`),
  UNIQUE KEY `uq_giftbox_instances_voucher_public_token` (`tenant_id`,`voucher_public_token`),
  KEY `idx_giftbox_id` (`giftbox_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_issued_at` (`issued_at`),
  KEY `idx_scheduled_send_on` (`scheduled_send_on`),
  KEY `idx_recipient_client` (`recipient_client_id`),
  KEY `idx_giftbox_instances_location_status` (`location_id`,`status`,`issued_at`),
  KEY `idx_email_send_claimed_at` (`email_send_claimed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_instances_tenant_id` BEFORE INSERT ON `giftbox_instances` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `giftbox_id` int(11) NOT NULL,
  `item_type` enum('service','product','custom') NOT NULL DEFAULT 'custom',
  `service_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `custom_label` varchar(120) DEFAULT NULL,
  `custom_details` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_giftbox_id` (`giftbox_id`),
  KEY `idx_type` (`item_type`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_items_tenant_id` BEFORE INSERT ON `giftbox_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_redemption_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_redemption_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `redemption_id` int(11) NOT NULL,
  `giftbox_item_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_redemption_id` (`redemption_id`),
  KEY `idx_giftbox_item_id` (`giftbox_item_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_redemption_items_tenant_id` BEFORE INSERT ON `giftbox_redemption_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_redemptions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `redeemed_at` datetime NOT NULL,
  `redeemed_by` int(11) DEFAULT NULL,
  `source_type` varchar(30) NOT NULL DEFAULT 'manual',
  `source_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_instance_id` (`instance_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_giftbox_redemptions_location_date` (`location_id`,`redeemed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_redemptions_tenant_id` BEFORE INSERT ON `giftbox_redemptions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftbox_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftbox_transactions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `instance_id` int(11) NOT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'adjust',
  `amount` int(11) NOT NULL DEFAULT 0,
  `note` varchar(255) DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_instance_created` (`instance_id`,`created_at`),
  KEY `idx_type` (`type`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_giftbox_transactions_location_created` (`location_id`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftbox_transactions_tenant_id` BEFORE INSERT ON `giftbox_transactions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftboxes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftboxes` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `eligibility` enum('fidelity_only','all_clients') NOT NULL DEFAULT 'fidelity_only',
  `points_cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `required_level_type` enum('points') DEFAULT NULL,
  `required_level_key` varchar(60) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `valid_from` date DEFAULT NULL,
  `valid_to` date DEFAULT NULL,
  `expires_after_days` int(11) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `eligible_levels_points` text DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_active` (`active`),
  KEY `idx_deleted` (`deleted_at`),
  KEY `idx_sort` (`sort_order`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftboxes_tenant_id` BEFORE INSERT ON `giftboxes` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftcard_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftcard_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `giftcard_id` int(11) NOT NULL,
  `item_type` enum('service','product') NOT NULL,
  `item_id` int(11) DEFAULT NULL,
  `item_name` varchar(190) DEFAULT NULL,
  `sku` varchar(64) DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `redeemed_qty` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_giftcard_id` (`giftcard_id`),
  KEY `idx_item_type` (`item_type`),
  KEY `idx_item_id` (`item_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftcard_items_tenant_id` BEFORE INSERT ON `giftcard_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftcard_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftcard_transactions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `giftcard_id` int(11) NOT NULL,
  `type` enum('issue','redeem','topup','cancel','adjust') NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `note` varchar(255) DEFAULT NULL,
  `meta_json` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_giftcard_id` (`giftcard_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_giftcard_transactions_location_created` (`location_id`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftcard_transactions_tenant_id` BEFORE INSERT ON `giftcard_transactions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `giftcards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `giftcards` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucher_public_token` char(64) DEFAULT NULL,
  `code` varchar(24) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `recipient_client_id` int(11) DEFAULT NULL,
  `recipient_name` varchar(120) DEFAULT NULL,
  `recipient_email` varchar(190) DEFAULT NULL,
  `initial_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `balance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'EUR',
  `status` enum('active','redeemed','cancelled','expired') NOT NULL DEFAULT 'active',
  `issued_at` datetime NOT NULL,
  `expires_at` date DEFAULT NULL,
  `redeemed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `gift_message` text DEFAULT NULL,
  `last_email_sent_at` datetime DEFAULT NULL,
  `last_email_sent_to` varchar(190) DEFAULT NULL,
  `last_email_hide_amount` tinyint(1) NOT NULL DEFAULT 0,
  `event_type` varchar(32) NOT NULL DEFAULT 'giftcard',
  `voucher_hide_amount` tinyint(1) NOT NULL DEFAULT 0,
  `scheduled_send_on` date DEFAULT NULL,
  `email_show_amount` tinyint(1) NOT NULL DEFAULT 1,
  `internal_note` text DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `email_send_claimed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uk_code` (`tenant_id`,`code`),
  UNIQUE KEY `uq_giftcards_voucher_public_token` (`tenant_id`,`voucher_public_token`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_status` (`status`),
  KEY `idx_issued_at` (`issued_at`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_scheduled_send_on` (`scheduled_send_on`),
  KEY `idx_recipient_client` (`recipient_client_id`),
  KEY `idx_giftcards_location_status` (`location_id`,`status`,`issued_at`),
  KEY `idx_email_send_claimed_at` (`email_send_claimed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_giftcards_tenant_id` BEFORE INSERT ON `giftcards` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `gifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gifts` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `eligibility` varchar(20) NOT NULL DEFAULT 'fidelity_only',
  `reward_type` varchar(20) NOT NULL DEFAULT 'custom',
  `reward_service_id` int(11) DEFAULT NULL,
  `reward_product_id` int(11) DEFAULT NULL,
  `reward_custom_label` varchar(255) DEFAULT NULL,
  `reward_custom_details` text DEFAULT NULL,
  `reward_items_json` longtext DEFAULT NULL,
  `redeem_points_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `redeem_points_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `repeatable` tinyint(1) NOT NULL DEFAULT 0,
  `max_redemptions_per_client` int(11) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `auto_disabled_by_fidelity` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `valid_from` datetime DEFAULT NULL,
  `valid_to` datetime DEFAULT NULL,
  `expires_after_days` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `eligible_levels_points` text DEFAULT NULL,
  `excluded_client_ids` text DEFAULT NULL,
  `terms_text` text DEFAULT NULL,
  `terms_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `cloned_from_gift_id` int(11) DEFAULT NULL,
  `replaced_by_gift_id` int(11) DEFAULT NULL,
  `replaced_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_fid_gifts_active` (`active`),
  KEY `idx_fid_gifts_valid` (`valid_from`,`valid_to`),
  KEY `idx_fid_gifts_deleted` (`deleted_at`),
  KEY `idx_gifts_cloned_from` (`cloned_from_gift_id`),
  KEY `idx_gifts_replaced_by` (`replaced_by_gift_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_gifts_tenant_id` BEFORE INSERT ON `gifts` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `item_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `item_rules` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_type` enum('service','product') NOT NULL,
  `item_id` int(11) NOT NULL,
  `earn_mode` varchar(12) NOT NULL DEFAULT 'default',
  `earn_multiplier` decimal(6,2) DEFAULT NULL,
  `earn_step_euro` decimal(10,2) DEFAULT NULL,
  `earn_fixed_points` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_item` (`tenant_id`,`item_type`,`item_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_item_rules_tenant_id` BEFORE INSERT ON `item_rules` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `location_deletion_log_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `location_deletion_log_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `log_id` int(11) NOT NULL,
  `group_name` varchar(80) NOT NULL,
  `table_name` varchar(120) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `action` varchar(40) NOT NULL DEFAULT 'delete',
  `meta_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_log_group` (`log_id`,`group_name`),
  KEY `idx_table_entity` (`table_name`,`entity_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_location_deletion_log_items_tenant_id` BEFORE INSERT ON `location_deletion_log_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `location_deletion_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `location_deletion_logs` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `summary_json` longtext DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  `deleted_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_location_deleted_at` (`location_id`,`deleted_at`),
  KEY `idx_deleted_by` (`deleted_by`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_location_deletion_logs_tenant_id` BEFORE INSERT ON `location_deletion_logs` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `location_gallery_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `location_gallery_images` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) NOT NULL,
  `path` varchar(255) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_location_gallery_sort` (`location_id`,`is_active`,`sort_order`,`id`),
  KEY `idx_location_gallery_order` (`location_id`,`sort_order`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_location_gallery_images_tenant_id` BEFORE INSERT ON `location_gallery_images` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `locations` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `phone` varchar(60) DEFAULT NULL,
  `whatsapp` varchar(60) DEFAULT NULL,
  `facebook_url` varchar(255) DEFAULT NULL,
  `instagram_url` varchar(255) DEFAULT NULL,
  `tiktok_url` varchar(255) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `booking_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `marketplace_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `legal_company_name` varchar(255) DEFAULT NULL,
  `legal_vat_number` varchar(40) DEFAULT NULL,
  `legal_tax_code` varchar(40) DEFAULT NULL,
  `legal_sdi` varchar(40) DEFAULT NULL,
  `legal_pec` varchar(190) DEFAULT NULL,
  `legal_address` varchar(255) DEFAULT NULL,
  `legal_cap` varchar(20) DEFAULT NULL,
  `legal_city` varchar(190) DEFAULT NULL,
  `legal_province` varchar(190) DEFAULT NULL,
  `legal_region` varchar(190) DEFAULT NULL,
  `legal_phone` varchar(60) DEFAULT NULL,
  `legal_email` varchar(190) DEFAULT NULL,
  `legal_website` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_locations_active_sort` (`is_active`,`sort_order`,`id`),
  KEY `idx_locations_booking_sort` (`booking_enabled`,`sort_order`,`id`),
  KEY `idx_locations_marketplace` (`marketplace_enabled`,`is_active`),
  KEY `idx_locations_booking` (`booking_enabled`,`is_active`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_locations_tenant_id` BEFORE INSERT ON `locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_attempts` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(190) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `attempted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `success` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_email_time` (`email`,`attempted_at`),
  KEY `idx_ip_time` (`ip`,`attempted_at`),
  KEY `idx_success_time` (`success`,`attempted_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=252 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_login_attempts_tenant_id` BEFORE INSERT ON `login_attempts` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `marketplace_activity_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_activity_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) NOT NULL,
  `name` varchar(190) NOT NULL,
  `icon_key` varchar(80) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketplace_activity_categories_slug` (`slug`),
  KEY `idx_marketplace_activity_categories_active` (`is_active`,`sort_order`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=11937 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `marketplace_location_activity_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_location_activity_categories` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `location_id` int(11) NOT NULL,
  `marketplace_category_id` int(11) NOT NULL,
  `marketplace_category_slug` varchar(120) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketplace_location_activity_category` (`tenant_id`,`location_id`,`marketplace_category_id`),
  KEY `idx_marketplace_location_activity_tenant` (`tenant_id`,`location_id`),
  KEY `idx_marketplace_location_activity_slug` (`tenant_slug`),
  KEY `idx_marketplace_location_activity_category` (`marketplace_category_slug`,`is_primary`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `marketplace_service_category_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_service_category_mappings` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `tenant_category_id` int(11) NOT NULL,
  `tenant_category_name` varchar(190) DEFAULT NULL,
  `marketplace_category_id` int(11) DEFAULT NULL,
  `marketplace_category_slug` varchar(120) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketplace_service_category_mapping` (`tenant_id`,`tenant_category_id`),
  KEY `idx_marketplace_service_category_mapping_slug` (`tenant_slug`),
  KEY `idx_marketplace_service_category_mapping_category` (`marketplace_category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `marketplace_taxonomy_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketplace_taxonomy_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) NOT NULL,
  `name` varchar(190) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_marketplace_taxonomy_categories_slug` (`slug`),
  KEY `idx_marketplace_taxonomy_categories_active` (`is_active`,`sort_order`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=58885 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `package_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `package_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NOT NULL,
  `item_type` varchar(20) NOT NULL,
  `item_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_type` varchar(10) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_item` (`item_type`,`item_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_package_items_tenant_id` BEFORE INSERT ON `package_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `package_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `package_locations` (
  `tenant_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`package_id`,`location_id`),
  KEY `idx_package_locations_location` (`location_id`),
  KEY `idx_package_locations_package` (`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_package_locations_tenant_id` BEFORE INSERT ON `package_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `package_pricing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `package_pricing` (
  `tenant_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_type` varchar(10) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_package_pricing_tenant_id` BEFORE INSERT ON `package_pricing` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `package_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `package_services` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `sessions_total` int(11) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_package_services_tenant_id` BEFORE INSERT ON `package_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `packages` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `description` text DEFAULT NULL,
  `service_id` int(11) DEFAULT NULL,
  `sessions_total` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `validity_days` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_packages_active` (`is_active`),
  KEY `idx_packages_service` (`service_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_packages_tenant_id` BEFORE INSERT ON `packages` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_resets` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_type` varchar(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `email` varchar(190) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `request_ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_password_resets_token` (`tenant_id`,`token_hash`),
  KEY `idx_password_resets_lookup` (`user_type`,`token_hash`),
  KEY `idx_password_resets_user` (`user_type`,`user_id`),
  KEY `idx_password_resets_exp` (`expires_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_password_resets_tenant_id` BEFORE INSERT ON `password_resets` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `tenant_id` int(11) NOT NULL,
  `perm` varchar(60) NOT NULL,
  `label` varchar(120) NOT NULL,
  `group_name` varchar(60) NOT NULL DEFAULT 'Generale',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`perm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_permissions_tenant_id` BEFORE INSERT ON `permissions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `point_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `point_lots` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `transaction_id` int(11) DEFAULT NULL,
  `source_type` varchar(20) DEFAULT NULL,
  `source_id` int(11) DEFAULT NULL,
  `earned_points` decimal(12,2) NOT NULL DEFAULT 0.00,
  `remaining_points` decimal(12,2) NOT NULL DEFAULT 0.00,
  `earned_at` datetime NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_tx` (`tenant_id`,`transaction_id`),
  KEY `idx_client` (`client_id`),
  KEY `idx_client_exp` (`client_id`,`expires_at`),
  KEY `idx_client_rem` (`client_id`,`remaining_points`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_point_lots_tenant_id` BEFORE INSERT ON `point_lots` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `pos_sale_stock_cancel_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pos_sale_stock_cancel_actions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sale_id` int(11) NOT NULL,
  `sale_item_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `qty` decimal(12,2) NOT NULL DEFAULT 0.00,
  `action` varchar(20) NOT NULL DEFAULT 'restored',
  `stock_before` decimal(12,2) DEFAULT NULL,
  `stock_after` decimal(12,2) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_sale` (`sale_id`),
  KEY `idx_product` (`product_id`),
  KEY `idx_action_created` (`action`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_pos_sale_stock_cancel_actions_tenant_id` BEFORE INSERT ON `pos_sale_stock_cancel_actions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `pos_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pos_settings` (
  `tenant_id` int(11) NOT NULL,
  `id` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `preorders_expiry_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `preorders_expiry_value` int(11) NOT NULL DEFAULT 0,
  `preorders_expiry_unit` varchar(10) NOT NULL DEFAULT 'days',
  `prepaids_expiry_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `prepaids_expiry_value` int(11) NOT NULL DEFAULT 0,
  `prepaids_expiry_unit` varchar(10) NOT NULL DEFAULT 'days',
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_pos_settings_tenant_id` BEFORE INSERT ON `pos_settings` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_categories` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_product_category_name` (`tenant_id`,`name`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_product_categories_tenant_id` BEFORE INSERT ON `product_categories` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_images` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_product` (`product_id`),
  KEY `idx_sort` (`product_id`,`sort_order`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_product_images_tenant_id` BEFORE INSERT ON `product_images` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `product_stocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_stocks` (
  `tenant_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `min_stock` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reorder_qty` decimal(12,2) NOT NULL DEFAULT 0.00,
  `incoming_qty` int(11) NOT NULL DEFAULT 0,
  `incoming_eta` date DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`,`product_id`,`location_id`),
  KEY `idx_product_stocks_location` (`location_id`),
  KEY `idx_product_stocks_product` (`product_id`),
  KEY `idx_product_stocks_enabled` (`location_id`,`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_product_stocks_tenant_id` BEFORE INSERT ON `product_stocks` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `brand` varchar(120) DEFAULT NULL,
  `internal_code` varchar(120) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ingredients` text DEFAULT NULL,
  `warnings` text DEFAULT NULL,
  `sku` varchar(80) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `purchase_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `supplier_name` varchar(190) DEFAULT NULL,
  `incoming_qty` int(11) NOT NULL DEFAULT 0,
  `incoming_eta` date DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `min_stock` int(11) NOT NULL DEFAULT 10,
  `reorder_qty` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sell_online` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_products_tenant_id` BEFORE INSERT ON `products` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_blackout_dates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_blackout_dates` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promotion_id` int(11) NOT NULL,
  `blackout_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uniq_promo_date` (`tenant_id`,`promotion_id`,`blackout_date`),
  KEY `idx_date` (`blackout_date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_blackout_dates_tenant_id` BEFORE INSERT ON `promotion_blackout_dates` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_locations` (
  `tenant_id` int(11) NOT NULL,
  `promotion_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`promotion_id`,`location_id`),
  KEY `idx_promotion_locations_location` (`location_id`),
  KEY `idx_promotion_locations_promotion` (`promotion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_locations_tenant_id` BEFORE INSERT ON `promotion_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_products` (
  `tenant_id` int(11) NOT NULL,
  `promotion_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `discount_mode` enum('inherit','percent','price') NOT NULL DEFAULT 'inherit',
  `discount_value` decimal(10,2) DEFAULT NULL,
  `discount_type` enum('percent','fixed') DEFAULT NULL,
  `min_subtotal` decimal(10,2) DEFAULT NULL,
  `min_qty` int(11) NOT NULL DEFAULT 1,
  `discounted_qty` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`promotion_id`,`product_id`),
  KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_products_tenant_id` BEFORE INSERT ON `promotion_products` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_redemptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_redemptions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promotion_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `sale_id` int(11) DEFAULT NULL,
  `appointment_id` int(11) DEFAULT NULL,
  `redeemed_at` datetime NOT NULL DEFAULT current_timestamp(),
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `meta` text DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_promo` (`promotion_id`),
  KEY `idx_client` (`client_id`),
  KEY `idx_redeemed_at` (`redeemed_at`),
  KEY `idx_promotion_redemptions_location` (`location_id`,`redeemed_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_redemptions_tenant_id` BEFORE INSERT ON `promotion_redemptions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_services` (
  `tenant_id` int(11) NOT NULL,
  `promotion_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `discount_mode` enum('inherit','percent','price') NOT NULL DEFAULT 'inherit',
  `discount_value` decimal(10,2) DEFAULT NULL,
  `discount_type` enum('percent','fixed') DEFAULT NULL,
  `min_subtotal` decimal(10,2) DEFAULT NULL,
  `min_qty` int(11) NOT NULL DEFAULT 1,
  `discounted_qty` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`promotion_id`,`service_id`),
  KEY `idx_service` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_services_tenant_id` BEFORE INSERT ON `promotion_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotion_time_windows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotion_time_windows` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promotion_id` int(11) NOT NULL,
  `day_of_week` tinyint(4) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_promo` (`promotion_id`),
  KEY `idx_dow` (`day_of_week`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotion_time_windows_tenant_id` BEFORE INSERT ON `promotion_time_windows` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `promotions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `promotions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(140) NOT NULL,
  `badge` varchar(40) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `cta_label` varchar(80) DEFAULT NULL,
  `coupon_code` varchar(40) DEFAULT NULL,
  `starts_at` date DEFAULT NULL,
  `ends_at` date DEFAULT NULL,
  `priority` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `auto_disabled_by_fidelity` tinyint(1) NOT NULL DEFAULT 0,
  `show_in_booking` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `discount_type` enum('percent','fixed') NOT NULL DEFAULT 'percent',
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `min_qty` int(11) NOT NULL DEFAULT 1,
  `discounted_qty` int(11) DEFAULT NULL,
  `qty_selection` enum('most_expensive','cheapest') NOT NULL DEFAULT 'most_expensive',
  `apply_services_mode` enum('none','all','selected') NOT NULL DEFAULT 'all',
  `apply_products_mode` enum('none','all','selected') NOT NULL DEFAULT 'none',
  `target_type` enum('all','new','inactive','birthday','fidelity') NOT NULL DEFAULT 'all',
  `new_within_days` int(11) DEFAULT NULL,
  `inactive_days` int(11) DEFAULT NULL,
  `birthday_window_days` int(11) DEFAULT NULL,
  `target_fidelity_levels` text DEFAULT NULL,
  `min_subtotal` decimal(10,2) DEFAULT NULL,
  `max_discount` decimal(10,2) DEFAULT NULL,
  `total_limit` int(11) DEFAULT NULL,
  `per_customer_limit` int(11) DEFAULT NULL,
  `per_day_limit` int(11) DEFAULT NULL,
  `stackable` int(11) NOT NULL DEFAULT 0,
  `stop_processing` tinyint(1) NOT NULL DEFAULT 0,
  `promo_conditions_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `promo_conditions` text DEFAULT NULL,
  `products_discount_type` enum('percent','fixed') DEFAULT NULL,
  `products_discount_value` decimal(10,2) DEFAULT NULL,
  `products_min_subtotal` decimal(10,2) DEFAULT NULL,
  `products_min_qty` int(11) DEFAULT NULL,
  `products_discounted_qty` int(11) DEFAULT NULL,
  `excluded_client_ids` text DEFAULT NULL,
  `marketplace_visibility` enum('auto','hidden') NOT NULL DEFAULT 'auto',
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_show_booking` (`show_in_booking`),
  KEY `idx_starts_at` (`starts_at`),
  KEY `idx_ends_at` (`ends_at`),
  KEY `idx_priority` (`priority`),
  KEY `idx_coupon_code` (`coupon_code`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_promotions_tenant_id` BEFORE INSERT ON `promotions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `public_customer_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `public_customer_accounts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(190) DEFAULT NULL,
  `first_name` varchar(120) DEFAULT NULL,
  `last_name` varchar(120) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login_at` datetime DEFAULT NULL,
  `email_verification_hash` char(64) DEFAULT NULL,
  `email_verification_expires_at` datetime DEFAULT NULL,
  `email_verification_sent_at` datetime DEFAULT NULL,
  `password_reset_hash` char(64) DEFAULT NULL,
  `password_reset_expires_at` datetime DEFAULT NULL,
  `password_reset_sent_at` datetime DEFAULT NULL,
  `pending_email` varchar(190) DEFAULT NULL,
  `pending_email_verification_hash` char(64) DEFAULT NULL,
  `pending_email_verification_expires_at` datetime DEFAULT NULL,
  `pending_email_verification_sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_public_customer_accounts_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `public_customer_favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `public_customer_favorites` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `location_id` int(11) NOT NULL DEFAULT 0,
  `location_slug` varchar(160) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_public_customer_favorite` (`account_id`,`tenant_slug`,`location_id`),
  KEY `idx_public_customer_favorites_account` (`account_id`,`created_at`),
  KEY `idx_public_customer_favorites_tenant` (`tenant_slug`,`location_id`),
  KEY `idx_public_customer_favorites_tenant_id` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `public_customer_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `public_customer_sessions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_public_customer_sessions_token` (`token_hash`),
  KEY `idx_public_customer_sessions_account` (`account_id`),
  KEY `idx_public_customer_sessions_expires` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=836 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `public_customer_tenant_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `public_customer_tenant_links` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `account_id` bigint(20) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `client_id` int(11) NOT NULL,
  `booking_user_id` int(11) DEFAULT NULL,
  `linked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_public_customer_tenant` (`account_id`,`tenant_id`),
  UNIQUE KEY `uq_public_customer_tenant_client` (`tenant_id`,`client_id`),
  KEY `idx_public_customer_tenant_slug` (`tenant_slug`),
  KEY `idx_public_customer_account` (`account_id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `quote_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quote_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quote_id` int(11) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `item_type` varchar(20) NOT NULL DEFAULT 'custom',
  `item_id` int(11) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `sku` varchar(60) DEFAULT NULL,
  `qty` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `discount_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `line_subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_tax` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_qi_quote` (`quote_id`),
  KEY `idx_qi_pos` (`position`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_quote_items_tenant_id` BEFORE INSERT ON `quote_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `quotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quotes` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `number` varchar(32) NOT NULL,
  `quote_date` date NOT NULL,
  `valid_until` date DEFAULT NULL,
  `client_id` int(11) DEFAULT NULL,
  `client_name` varchar(190) DEFAULT NULL,
  `client_company_name` varchar(255) DEFAULT NULL,
  `client_vat_number` varchar(40) DEFAULT NULL,
  `client_tax_code` varchar(40) DEFAULT NULL,
  `client_sdi` varchar(40) DEFAULT NULL,
  `client_pec` varchar(190) DEFAULT NULL,
  `client_email` varchar(190) DEFAULT NULL,
  `client_phone` varchar(40) DEFAULT NULL,
  `client_address` varchar(255) DEFAULT NULL,
  `client_cap` varchar(20) DEFAULT NULL,
  `client_city` varchar(190) DEFAULT NULL,
  `client_province` varchar(190) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `public_token` varchar(64) DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `sent_to_email` varchar(190) DEFAULT NULL,
  `public_note` text DEFAULT NULL,
  `payment_methods` text DEFAULT NULL,
  `customer_decision_at` datetime DEFAULT NULL,
  `customer_decision_source` varchar(30) DEFAULT NULL,
  `customer_decision_seen_at` datetime DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `location_address` varchar(255) DEFAULT NULL,
  `location_phone` varchar(60) DEFAULT NULL,
  `location_email` varchar(190) DEFAULT NULL,
  `location_company_name` varchar(255) DEFAULT NULL,
  `location_vat_number` varchar(40) DEFAULT NULL,
  `location_tax_code` varchar(40) DEFAULT NULL,
  `location_sdi` varchar(40) DEFAULT NULL,
  `location_pec` varchar(190) DEFAULT NULL,
  `location_cap` varchar(20) DEFAULT NULL,
  `location_city` varchar(190) DEFAULT NULL,
  `location_province` varchar(190) DEFAULT NULL,
  `location_region` varchar(190) DEFAULT NULL,
  `location_website` varchar(190) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_quote_number` (`tenant_id`,`number`),
  UNIQUE KEY `uq_quote_public_token` (`tenant_id`,`public_token`),
  KEY `idx_quote_date` (`quote_date`),
  KEY `idx_quote_client` (`client_id`),
  KEY `idx_quote_status` (`status`),
  KEY `idx_quote_valid_until` (`valid_until`),
  KEY `idx_quote_customer_decision_seen` (`customer_decision_seen_at`,`status`),
  KEY `idx_quotes_location_date` (`location_id`,`quote_date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_quotes_tenant_id` BEFORE INSERT ON `quotes` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `recharge_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recharge_templates` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(120) NOT NULL,
  `base_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `bonus_kind` enum('none','percent','fixed') NOT NULL DEFAULT 'none',
  `bonus_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `earn_points` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_sort` (`sort_order`),
  KEY `idx_title` (`title`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_recharge_templates_tenant_id` BEFORE INSERT ON `recharge_templates` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `recharges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recharges` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `card_id` int(11) NOT NULL,
  `template_id` int(11) DEFAULT NULL,
  `sale_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `base_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `bonus_kind` enum('none','percent','fixed') NOT NULL DEFAULT 'none',
  `bonus_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `bonus_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `earn_points` tinyint(1) NOT NULL DEFAULT 1,
  `points_earned` decimal(12,2) NOT NULL DEFAULT 0.00,
  `note` varchar(255) DEFAULT NULL,
  `is_void` tinyint(1) NOT NULL DEFAULT 0,
  `voided_at` datetime DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `fidelity_campaign_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_client` (`client_id`),
  KEY `idx_card` (`card_id`),
  KEY `idx_template` (`template_id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_void` (`is_void`),
  KEY `idx_recharges_sale` (`sale_id`),
  KEY `idx_recharges_location_created` (`location_id`,`created_at`),
  KEY `idx_recharges_client_location` (`client_id`,`location_id`),
  KEY `idx_recharges_fidelity_campaign_id` (`fidelity_campaign_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_recharges_tenant_id` BEFORE INSERT ON `recharges` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reminders` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `channel` enum('email','sms','whatsapp') NOT NULL DEFAULT 'email',
  `scheduled_at` datetime NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `last_error` text DEFAULT NULL,
  `provider` varchar(40) DEFAULT NULL,
  `provider_message_id` varchar(120) DEFAULT NULL,
  `provider_state` varchar(40) DEFAULT NULL,
  `provider_price` decimal(10,4) DEFAULT NULL,
  `provider_total_price` decimal(10,4) DEFAULT NULL,
  `sms_segments` int(11) DEFAULT NULL,
  `sms_credits_used` int(11) DEFAULT NULL,
  `provider_response_json` mediumtext DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `last_checked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `fk_rem_appt` (`appointment_id`),
  KEY `idx_rem_sched` (`scheduled_at`),
  KEY `idx_rem_status` (`status`),
  KEY `idx_rem_provider_message` (`provider`,`provider_message_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_reminders_tenant_id` BEFORE INSERT ON `reminders` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `resource_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `resource_locations` (
  `tenant_id` int(11) NOT NULL,
  `resource_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `qty_total` int(11) NOT NULL DEFAULT 0,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`resource_id`,`location_id`),
  KEY `idx_resource_locations_location` (`location_id`),
  KEY `idx_resource_locations_enabled` (`location_id`,`is_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_resource_locations_tenant_id` BEFORE INSERT ON `resource_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `resources` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `description` text DEFAULT NULL,
  `qty_total` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_name` (`tenant_id`,`name`),
  KEY `idx_qty_total` (`qty_total`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_resources_tenant_id` BEFORE INSERT ON `resources` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `role_permission_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permission_audit_log` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_user_id` int(11) DEFAULT NULL,
  `actor_name` varchar(190) DEFAULT NULL,
  `actor_email` varchar(190) DEFAULT NULL,
  `role` varchar(20) NOT NULL,
  `old_perms` longtext NOT NULL,
  `new_perms` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_role_created` (`role`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_role_permission_audit_log_tenant_id` BEFORE INSERT ON `role_permission_audit_log` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permissions` (
  `tenant_id` int(11) NOT NULL,
  `role` varchar(20) NOT NULL,
  `perm` varchar(60) NOT NULL,
  PRIMARY KEY (`tenant_id`,`role`,`perm`),
  KEY `fk_role_perm` (`perm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_role_permissions_tenant_id` BEFORE INSERT ON `role_permissions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `saas_admin_login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_admin_login_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(190) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `attempted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `success` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_email_time` (`email`,`attempted_at`),
  KEY `idx_ip_time` (`ip`,`attempted_at`),
  KEY `idx_success_time` (`success`,`attempted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('owner','admin','viewer') NOT NULL DEFAULT 'admin',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saas_admins_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_professional_signups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_professional_signups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `business_name` varchar(190) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `owner_name` varchar(190) NOT NULL,
  `owner_email` varchar(190) NOT NULL,
  `owner_phone` varchar(40) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('pending_verification','verified','provisioning','active','failed','rejected') NOT NULL DEFAULT 'pending_verification',
  `verification_hash` char(64) DEFAULT NULL,
  `verification_expires_at` datetime DEFAULT NULL,
  `verification_sent_at` datetime DEFAULT NULL,
  `verification_attempts` int(11) NOT NULL DEFAULT 0,
  `verification_locked_until` datetime DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `terms_accepted_at` datetime DEFAULT NULL,
  `marketing_opt_in` tinyint(1) NOT NULL DEFAULT 0,
  `request_ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `provisioning_error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_prof_signup_email` (`owner_email`),
  KEY `idx_prof_signup_slug` (`slug`),
  KEY `idx_prof_signup_status` (`status`,`created_at`),
  KEY `idx_prof_signup_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_sms_order_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_sms_order_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `message` varchar(255) DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_sms_order_events_order` (`order_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_sms_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_sms_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `plan_id` int(11) DEFAULT NULL,
  `source` enum('manual','payment') NOT NULL DEFAULT 'manual',
  `status` enum('pending','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  `credits` int(11) NOT NULL DEFAULT 0,
  `amount_gross` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `payment_provider` varchar(60) DEFAULT NULL,
  `payment_id` varchar(120) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by_admin_id` int(11) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_sms_orders_tenant` (`tenant_id`,`created_at`),
  KEY `idx_saas_sms_orders_status` (`status`,`created_at`),
  KEY `idx_saas_sms_orders_plan` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_sms_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_sms_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `credits` int(11) NOT NULL DEFAULT 0,
  `price_gross` decimal(10,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_sms_plans_active` (`is_active`,`sort_order`),
  KEY `idx_saas_sms_plans_sort` (`sort_order`,`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_sms_pricing_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_sms_pricing_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `provider_cost_per_segment` decimal(10,4) NOT NULL DEFAULT 0.0490,
  `target_margin_percent` decimal(6,2) NOT NULL DEFAULT 25.00,
  `payment_fee_percent` decimal(6,2) NOT NULL DEFAULT 2.00,
  `payment_fee_fixed` decimal(10,2) NOT NULL DEFAULT 0.30,
  `suggested_credit_price` decimal(10,4) NOT NULL DEFAULT 0.0700,
  `currency` varchar(3) NOT NULL DEFAULT 'EUR',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_support_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_support_access_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by_admin_id` int(11) DEFAULT NULL,
  `created_by_name` varchar(120) DEFAULT NULL,
  `created_by_email` varchar(190) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `used_ip` varchar(45) DEFAULT NULL,
  `used_user_agent` varchar(255) DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saas_support_access_token_hash` (`token_hash`),
  KEY `idx_saas_support_access_tenant` (`tenant_id`,`created_at`),
  KEY `idx_saas_support_access_active` (`tenant_slug`,`expires_at`,`used_at`,`revoked_at`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_tenant_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_tenant_audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_admin_id` int(11) DEFAULT NULL,
  `actor_name` varchar(120) DEFAULT NULL,
  `actor_email` varchar(190) DEFAULT NULL,
  `tenant_id` int(11) DEFAULT NULL,
  `tenant_slug` varchar(80) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `message` varchar(255) DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_tenant_audit_tenant` (`tenant_id`,`created_at`),
  KEY `idx_saas_tenant_audit_action` (`action`,`created_at`),
  KEY `idx_saas_tenant_audit_actor` (`actor_admin_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_tenant_backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_tenant_backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `created_by_admin_id` int(11) DEFAULT NULL,
  `created_by_name` varchar(120) DEFAULT NULL,
  `created_by_email` varchar(190) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `backup_path` varchar(500) NOT NULL,
  `backup_size` bigint(20) NOT NULL DEFAULT 0,
  `status` enum('completed','failed') NOT NULL DEFAULT 'completed',
  `meta_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_tenant_backups_tenant` (`tenant_id`,`created_at`),
  KEY `idx_saas_tenant_backups_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_tenant_health_checks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_tenant_health_checks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `level` enum('ok','warning','error') NOT NULL DEFAULT 'ok',
  `errors_count` int(11) NOT NULL DEFAULT 0,
  `warnings_count` int(11) NOT NULL DEFAULT 0,
  `source` varchar(30) DEFAULT NULL,
  `checks_json` longtext DEFAULT NULL,
  `missing_schema_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_saas_health_tenant` (`tenant_id`,`created_at`),
  KEY `idx_saas_health_level` (`level`,`created_at`),
  KEY `idx_saas_health_source` (`source`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `saas_tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saas_tenants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) NOT NULL,
  `name` varchar(190) NOT NULL,
  `db_prefix` varchar(90) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `status` enum('provisioning','active','suspended','failed','deleted') NOT NULL DEFAULT 'active',
  `admin_email` varchar(190) DEFAULT NULL,
  `plan` varchar(80) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `provisioning_error` text DEFAULT NULL,
  `provisioned_at` datetime DEFAULT NULL,
  `suspended_at` datetime DEFAULT NULL,
  `suspended_reason` text DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_reason` text DEFAULT NULL,
  `created_by_admin_id` int(11) DEFAULT NULL,
  `updated_by_admin_id` int(11) DEFAULT NULL,
  `health_level` enum('ok','warning','error') DEFAULT NULL,
  `health_errors` int(11) NOT NULL DEFAULT 0,
  `health_warnings` int(11) NOT NULL DEFAULT 0,
  `health_checked_at` datetime DEFAULT NULL,
  `health_source` varchar(30) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `source` enum('admin','self_signup') NOT NULL DEFAULT 'admin',
  `signup_id` int(11) DEFAULT NULL,
  `owner_email_verified_at` datetime DEFAULT NULL,
  `booking_public_allowed` tinyint(1) NOT NULL DEFAULT 1,
  `marketplace_public_allowed` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saas_tenants_slug` (`slug`),
  KEY `idx_saas_tenants_status` (`status`,`is_active`),
  KEY `idx_saas_tenants_admin_email` (`admin_email`),
  KEY `idx_saas_tenants_health` (`health_level`,`health_checked_at`),
  KEY `idx_saas_tenants_source` (`source`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sale_installment_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sale_installment_plans` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sale_id` int(11) NOT NULL DEFAULT 0,
  `client_id` int(11) DEFAULT NULL,
  `payment_type` varchar(20) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `sale_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `down_payment_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `financed_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `installments_count` int(11) NOT NULL DEFAULT 1,
  `interval_value` int(11) NOT NULL DEFAULT 1,
  `interval_unit` varchar(20) NOT NULL DEFAULT 'month',
  `first_due_date` date DEFAULT NULL,
  `last_due_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `config_json` longtext DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_sale` (`tenant_id`,`sale_id`),
  KEY `idx_client_status` (`client_id`,`status`),
  KEY `idx_first_due` (`first_due_date`),
  KEY `idx_last_due` (`last_due_date`),
  KEY `idx_payment_type` (`payment_type`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_sale_installment_plans_tenant_id` BEFORE INSERT ON `sale_installment_plans` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `sale_installments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sale_installments` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL DEFAULT 0,
  `sale_id` int(11) NOT NULL DEFAULT 0,
  `client_id` int(11) DEFAULT NULL,
  `installment_no` int(11) NOT NULL DEFAULT 1,
  `due_date` date NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `payment_type` varchar(20) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `paid_amount` decimal(10,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_plan_no` (`tenant_id`,`plan_id`,`installment_no`),
  KEY `idx_sale` (`sale_id`),
  KEY `idx_client_due_status` (`client_id`,`due_date`,`status`),
  KEY `idx_due_status` (`due_date`,`status`),
  KEY `idx_payment_type` (`payment_type`),
  KEY `idx_paid_at` (`paid_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_sale_installments_tenant_id` BEFORE INSERT ON `sale_installments` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sale_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sale_id` int(11) NOT NULL,
  `item_type` enum('service','product') NOT NULL,
  `item_id` int(11) DEFAULT NULL,
  `item_name` varchar(190) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `item_status` varchar(20) DEFAULT NULL,
  `preorder_expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_sale_items_sale` (`sale_id`),
  KEY `idx_preorder_expires_at` (`preorder_expires_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_sale_items_tenant_id` BEFORE INSERT ON `sale_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sales` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) DEFAULT NULL,
  `fidelity_card_id` int(11) DEFAULT NULL,
  `fidelity_card_code` varchar(20) DEFAULT NULL,
  `sale_date` datetime NOT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `coupon_code` varchar(40) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `fidelity_points_earned` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_campaign_id` int(11) DEFAULT NULL,
  `credit_used` decimal(10,2) NOT NULL DEFAULT 0.00,
  `giftcard_id` int(11) DEFAULT NULL,
  `giftcard_used` decimal(10,2) NOT NULL DEFAULT 0.00,
  `fidelity_points_used` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fidelity_discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'done',
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `source_quote_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `operator_name` varchar(120) DEFAULT NULL,
  `promotion_applied_id` int(11) DEFAULT NULL,
  `promotion_applied_name` varchar(190) DEFAULT NULL,
  `promotion_applied_discount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `promotion_applied_non_discounted_subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `fk_sale_client` (`client_id`),
  KEY `idx_sale_date` (`sale_date`),
  KEY `idx_sales_status` (`status`),
  KEY `idx_sales_giftcard_id` (`giftcard_id`),
  KEY `idx_source_quote_id` (`source_quote_id`),
  KEY `idx_sales_fidelity_campaign_id` (`fidelity_campaign_id`),
  KEY `idx_fidelity_card_id` (`fidelity_card_id`),
  KEY `idx_fidelity_card_code` (`fidelity_card_code`),
  KEY `idx_sales_location_date` (`location_id`,`sale_date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_sales_tenant_id` BEFORE INSERT ON `sales` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `service_cabins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_cabins` (
  `tenant_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `cabin_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`service_id`,`cabin_id`),
  KEY `idx_sc_service` (`service_id`),
  KEY `idx_sc_cabin` (`cabin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_service_cabins_tenant_id` BEFORE INSERT ON `service_cabins` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `service_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_categories` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_service_categories_sort` (`sort_order`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_service_categories_tenant_id` BEFORE INSERT ON `service_categories` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `service_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_locations` (
  `tenant_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`service_id`,`location_id`),
  KEY `idx_service_locations_location` (`location_id`),
  KEY `idx_service_locations_service` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_service_locations_tenant_id` BEFORE INSERT ON `service_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `service_recommendations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_recommendations` (
  `tenant_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `recommended_service_id` int(11) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`service_id`,`recommended_service_id`),
  KEY `idx_sr_recommended` (`recommended_service_id`),
  KEY `idx_sr_sort` (`service_id`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_service_recommendations_tenant_id` BEFORE INSERT ON `service_recommendations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `service_resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `service_resources` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `service_id` int(11) NOT NULL,
  `resource_id` int(11) NOT NULL,
  `qty_required` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_service_resource` (`tenant_id`,`service_id`,`resource_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_resource_id` (`resource_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_service_resources_tenant_id` BEFORE INSERT ON `service_resources` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `services` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) DEFAULT NULL,
  `cabin_id` int(11) DEFAULT NULL,
  `name` varchar(190) NOT NULL,
  `duration_min` int(11) NOT NULL DEFAULT 60,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `booking_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `no_operator` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_services_active` (`is_active`),
  KEY `idx_services_category` (`category_id`),
  KEY `idx_services_name` (`name`),
  KEY `idx_services_sort` (`category_id`,`sort_order`),
  KEY `idx_services_cabin` (`cabin_id`),
  KEY `idx_services_booking` (`booking_enabled`,`is_active`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_services_tenant_id` BEFORE INSERT ON `services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `sms_credit_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_credit_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `type` varchar(30) NOT NULL,
  `credits` int(11) NOT NULL DEFAULT 0,
  `balance_before` int(11) NOT NULL DEFAULT 0,
  `balance_after` int(11) NOT NULL DEFAULT 0,
  `reference_type` varchar(60) DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sms_credit_created` (`created_at`),
  KEY `idx_sms_credit_reference` (`reference_type`,`reference_id`),
  KEY `idx_sms_credit_movements_tenant_created` (`tenant_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sms_credit_wallet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sms_credit_wallet` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT NULL,
  `balance_credits` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sms_credit_wallet_tenant` (`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(190) NOT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `calendar_color` varchar(16) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_tenant_id` BEFORE INSERT ON `staff` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_availability` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `staff_id` int(11) NOT NULL,
  `kind` varchar(20) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `series_uid` varchar(40) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_staff_time` (`staff_id`,`starts_at`,`ends_at`),
  KEY `idx_kind` (`kind`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_availability_tenant_id` BEFORE INSERT ON `staff_availability` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_commission_module_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_commission_module_periods` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `started_by` int(11) DEFAULT NULL,
  `ended_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_module_period` (`started_at`,`ended_at`),
  KEY `idx_started_at` (`started_at`),
  KEY `idx_ended_at` (`ended_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_commission_module_periods_tenant_id` BEFORE INSERT ON `staff_commission_module_periods` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_commission_module_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_commission_module_settings` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_commission_module_settings_tenant_id` BEFORE INSERT ON `staff_commission_module_settings` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_commission_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_commission_payments` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_key` char(40) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `source_group` varchar(20) NOT NULL DEFAULT '',
  `source_reference` varchar(60) DEFAULT NULL,
  `source_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `movement_datetime` datetime DEFAULT NULL,
  `client_name` varchar(190) DEFAULT NULL,
  `item_label` varchar(190) DEFAULT NULL,
  `base_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `percent_value` decimal(5,2) NOT NULL DEFAULT 0.00,
  `operator_name` varchar(190) DEFAULT NULL,
  `source_label` varchar(60) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `commission_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_paid` tinyint(1) NOT NULL DEFAULT 0,
  `entry_status` varchar(20) NOT NULL DEFAULT 'active',
  `paid_at` datetime DEFAULT NULL,
  `paid_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_entry_key` (`tenant_id`,`entry_key`),
  KEY `idx_staff_paid` (`staff_id`,`is_paid`,`movement_datetime`),
  KEY `idx_paid_at` (`paid_at`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_status` (`entry_status`),
  KEY `idx_source_reference` (`source_group`,`source_reference`),
  KEY `idx_location_date` (`location_id`,`movement_datetime`,`entry_status`),
  KEY `idx_source_id` (`source_group`,`source_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_commission_payments_tenant_id` BEFORE INSERT ON `staff_commission_payments` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_commission_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_commission_periods` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `staff_id` int(11) NOT NULL,
  `started_at` datetime NOT NULL,
  `ended_at` datetime DEFAULT NULL,
  `started_by` int(11) DEFAULT NULL,
  `ended_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_staff_period` (`staff_id`,`started_at`,`ended_at`),
  KEY `idx_started_at` (`started_at`),
  KEY `idx_ended_at` (`ended_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_commission_periods_tenant_id` BEFORE INSERT ON `staff_commission_periods` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_commission_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_commission_settings` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `staff_id` int(11) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `calculation_mode` varchar(20) NOT NULL DEFAULT 'paid_amount',
  `appointment_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `pos_product_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `pos_service_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `pos_other_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_staff` (`tenant_id`,`staff_id`),
  KEY `idx_enabled` (`is_enabled`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_commission_settings_tenant_id` BEFORE INSERT ON `staff_commission_settings` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_locations` (
  `tenant_id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`staff_id`,`location_id`),
  KEY `idx_staff_locations_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_locations_tenant_id` BEFORE INSERT ON `staff_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_services` (
  `tenant_id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  PRIMARY KEY (`tenant_id`,`staff_id`,`service_id`),
  KEY `fk_ss_service` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_services_tenant_id` BEFORE INSERT ON `staff_services` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `staff_timeoff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_timeoff` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `reason` varchar(190) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_staff_timeoff_tenant_id` BEFORE INSERT ON `staff_timeoff` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `stock_doc_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_doc_items` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stock_doc_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 0,
  `incoming_flag` tinyint(1) NOT NULL DEFAULT 0,
  `incoming_qty` int(11) NOT NULL DEFAULT 0,
  `incoming_eta` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_doc` (`stock_doc_id`),
  KEY `idx_product` (`product_id`),
  KEY `idx_doc_product` (`stock_doc_id`,`product_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_stock_doc` (`stock_doc_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_stock_doc_items_tenant_id` BEFORE INSERT ON `stock_doc_items` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `stock_docs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_docs` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `move_date` date NOT NULL,
  `operator_user_id` int(11) DEFAULT NULL,
  `operator_name` varchar(190) NOT NULL,
  `cause` enum('carico','scarico') NOT NULL,
  `document_type` enum('DDT','Fattura') DEFAULT NULL,
  `document_number` varchar(80) DEFAULT NULL,
  `document_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_mime` varchar(80) DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  `attachment_size` int(11) DEFAULT NULL,
  `is_canceled` tinyint(1) NOT NULL DEFAULT 0,
  `canceled_at` datetime DEFAULT NULL,
  `canceled_by_user_id` int(11) DEFAULT NULL,
  `canceled_by_name` varchar(190) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_move_date` (`move_date`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_canceled` (`is_canceled`),
  KEY `idx_stock_docs_location_date` (`location_id`,`move_date`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_stock_docs_tenant_id` BEFORE INSERT ON `stock_docs` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `stock_moves`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stock_moves` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `move_date` date NOT NULL,
  `operator_user_id` int(11) DEFAULT NULL,
  `operator_name` varchar(190) NOT NULL,
  `cause` enum('carico','scarico') NOT NULL,
  `document_type` enum('DDT','Fattura') DEFAULT NULL,
  `document_number` varchar(80) DEFAULT NULL,
  `document_date` date DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 0,
  `incoming_flag` tinyint(1) NOT NULL DEFAULT 0,
  `incoming_qty` int(11) NOT NULL DEFAULT 0,
  `incoming_eta` date DEFAULT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_mime` varchar(80) DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  `attachment_size` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_move_date` (`move_date`),
  KEY `idx_product` (`product_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_stock_moves_tenant_id` BEFORE INSERT ON `stock_moves` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `supplier_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `supplier_locations` (
  `tenant_id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `warehouse_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `costs_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`tenant_id`,`supplier_id`,`location_id`),
  KEY `idx_supplier_locations_location` (`location_id`),
  KEY `idx_supplier_locations_warehouse` (`location_id`,`warehouse_enabled`),
  KEY `idx_supplier_locations_costs` (`location_id`,`costs_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_supplier_locations_tenant_id` BEFORE INSERT ON `supplier_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(190) NOT NULL,
  `business_name` varchar(255) DEFAULT NULL,
  `address1` varchar(255) DEFAULT NULL,
  `address2` varchar(255) DEFAULT NULL,
  `cap` varchar(20) DEFAULT NULL,
  `city` varchar(190) DEFAULT NULL,
  `province` varchar(80) DEFAULT NULL,
  `country` varchar(190) DEFAULT NULL,
  `country_iso` varchar(10) DEFAULT NULL,
  `vat_number` varchar(40) DEFAULT NULL,
  `tax_code` varchar(40) DEFAULT NULL,
  `sdi_code` varchar(30) DEFAULT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `fax` varchar(40) DEFAULT NULL,
  `mobile` varchar(40) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `pec` varchar(190) DEFAULT NULL,
  `website` varchar(190) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_active_costs` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_supplier_name` (`tenant_id`,`name`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_suppliers_tenant_id` BEFORE INSERT ON `suppliers` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `tenant_directory_location_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_directory_location_categories` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `location_id` int(11) NOT NULL,
  `location_slug` varchar(160) NOT NULL,
  `marketplace_category_id` int(11) NOT NULL,
  `marketplace_category_slug` varchar(120) NOT NULL,
  `marketplace_category_name` varchar(190) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_directory_location_category` (`tenant_id`,`location_id`,`marketplace_category_id`),
  KEY `idx_tenant_directory_location_categories_tenant` (`tenant_id`,`location_id`),
  KEY `idx_tenant_directory_location_categories_slug` (`tenant_slug`,`location_slug`),
  KEY `idx_tenant_directory_location_categories_category` (`marketplace_category_slug`,`is_primary`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tenant_directory_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_directory_locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `location_id` int(11) NOT NULL,
  `location_slug` varchar(160) NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(20) NOT NULL DEFAULT 'published',
  `tenant_title` varchar(190) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `province` varchar(80) DEFAULT NULL,
  `region` varchar(120) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `whatsapp` varchar(50) DEFAULT NULL,
  `facebook_url` varchar(255) DEFAULT NULL,
  `instagram_url` varchar(255) DEFAULT NULL,
  `tiktok_url` varchar(255) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `booking_url` varchar(255) DEFAULT NULL,
  `booking_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `marketplace_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `primary_category_slug` varchar(120) DEFAULT NULL,
  `primary_category_name` varchar(190) DEFAULT NULL,
  `category_text` varchar(255) DEFAULT NULL,
  `search_text` text DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_directory_locations_location` (`tenant_id`,`location_id`),
  UNIQUE KEY `uq_tenant_directory_locations_slug` (`tenant_slug`,`location_slug`),
  KEY `idx_tenant_directory_locations_public` (`is_visible`,`status`,`sort_order`),
  KEY `idx_tenant_directory_locations_city` (`city`),
  KEY `idx_tenant_directory_locations_region` (`region`),
  KEY `idx_tenant_directory_locations_tenant` (`tenant_id`),
  KEY `idx_tenant_directory_locations_booking` (`booking_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=735 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tenant_directory_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_directory_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `is_visible` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `title` varchar(190) DEFAULT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category_text` varchar(255) DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `province` varchar(80) DEFAULT NULL,
  `region` varchar(120) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(190) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `logo_image` varchar(255) DEFAULT NULL,
  `cover_image` varchar(255) DEFAULT NULL,
  `logo_position_x` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `logo_position_y` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `cover_position_x` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `cover_position_y` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `booking_url` varchar(255) DEFAULT NULL,
  `search_text` text DEFAULT NULL,
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_directory_profiles_tenant` (`tenant_id`),
  UNIQUE KEY `uq_tenant_directory_profiles_slug` (`tenant_slug`),
  KEY `idx_tenant_directory_profiles_public` (`is_visible`,`status`,`featured`,`sort_order`),
  KEY `idx_tenant_directory_profiles_city` (`city`),
  KEY `idx_tenant_directory_profiles_region` (`region`)
) ENGINE=InnoDB AUTO_INCREMENT=426 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tenant_directory_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_directory_services` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `tenant_slug` varchar(80) NOT NULL,
  `service_id` int(11) NOT NULL,
  `service_name` varchar(190) NOT NULL,
  `service_category_id` int(11) DEFAULT NULL,
  `service_category_name` varchar(190) DEFAULT NULL,
  `marketplace_category_id` int(11) DEFAULT NULL,
  `marketplace_category_slug` varchar(120) DEFAULT NULL,
  `marketplace_category_name` varchar(190) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `booking_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `search_text` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_directory_service` (`tenant_id`,`service_id`),
  KEY `idx_tenant_directory_services_tenant` (`tenant_id`),
  KEY `idx_tenant_directory_services_slug` (`tenant_slug`),
  KEY `idx_tenant_directory_services_name` (`service_name`),
  KEY `idx_tenant_directory_services_marketplace` (`marketplace_category_slug`),
  KEY `idx_tenant_directory_services_public` (`is_active`,`booking_enabled`)
) ENGINE=InnoDB AUTO_INCREMENT=397 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tenant_onboarding_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenant_onboarding_progress` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `status` enum('not_started','in_progress','completed','dismissed') NOT NULL DEFAULT 'not_started',
  `current_step` varchar(50) NOT NULL DEFAULT 'business',
  `completed_steps_json` longtext DEFAULT NULL,
  `skipped_steps_json` longtext DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `dismissed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_onboarding_progress_tenant` (`tenant_id`),
  KEY `idx_tenant_onboarding_progress_status` (`status`),
  CONSTRAINT `fk_tenant_onboarding_progress_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `saas_tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4834 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transactions` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `kind` varchar(20) NOT NULL DEFAULT 'manual',
  `source_type` varchar(20) DEFAULT NULL,
  `source_id` int(11) DEFAULT NULL,
  `delta_points` decimal(12,2) NOT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `location_name` varchar(190) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `uq_fid_src` (`tenant_id`,`client_id`,`kind`,`source_type`,`source_id`),
  KEY `idx_fid_client` (`client_id`),
  KEY `idx_fid_created` (`created_at`),
  KEY `idx_fid_kind` (`kind`),
  KEY `idx_transactions_location_created` (`location_id`,`created_at`),
  KEY `idx_transactions_client_location` (`client_id`,`location_id`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_transactions_tenant_id` BEFORE INSERT ON `transactions` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `user_email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_email_verifications` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `new_email` varchar(190) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `attempt_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `last_attempt_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  KEY `idx_u_ev_user` (`user_id`),
  KEY `idx_u_ev_exp` (`expires_at`),
  KEY `idx_u_ev_user_created` (`user_id`,`created_at`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_user_email_verifications_tenant_id` BEFORE INSERT ON `user_email_verifications` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `user_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_locations` (
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`user_id`,`location_id`),
  KEY `idx_user_locations_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_user_locations_tenant_id` BEFORE INSERT ON `user_locations` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `tenant_id` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','staff','altro') NOT NULL DEFAULT 'admin',
  `calendar_day_staff_order` text DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `browser_notification_preferences` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tenant_id`,`id`),
  UNIQUE KEY `email` (`tenant_id`,`email`),
  KEY `idx_tenant_local_id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_users_tenant_id` BEFORE INSERT ON `users` FOR EACH ROW SET NEW.`tenant_id` = IF(NEW.`tenant_id` IS NULL OR NEW.`tenant_id` = 0, COALESCE(@app_tenant_id, 0), NEW.`tenant_id`) */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

