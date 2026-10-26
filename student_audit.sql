-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 26, 2026 at 11:48 AM
-- Server version: 10.11.16-MariaDB
-- PHP Version: 8.5.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `student_audit`
--

-- --------------------------------------------------------

--
-- Table structure for table `auditor_receipt_entries`
--

CREATE TABLE `auditor_receipt_entries` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `request_id` char(36) NOT NULL,
  `sheet_id` bigint(20) UNSIGNED NOT NULL,
  `entry_date` date NOT NULL,
  `entry_type` varchar(20) NOT NULL,
  `voucher_no` varchar(100) NOT NULL DEFAULT '',
  `or_number` varchar(120) NOT NULL DEFAULT '',
  `payee` varchar(200) NOT NULL DEFAULT '',
  `nature` text NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `document_id` int(11) DEFAULT NULL,
  `audit_status` varchar(30) NOT NULL DEFAULT 'pending',
  `audit_note` varchar(1000) NOT NULL DEFAULT '',
  `created_by_id` int(11) NOT NULL,
  `created_by` varchar(150) NOT NULL,
  `recorded_at` datetime NOT NULL,
  `voided_at` datetime DEFAULT NULL,
  `voided_by` varchar(150) DEFAULT NULL,
  `void_reason` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auditor_receipt_entries`
--

INSERT INTO `auditor_receipt_entries` (`id`, `request_id`, `sheet_id`, `entry_date`, `entry_type`, `voucher_no`, `or_number`, `payee`, `nature`, `amount`, `document_id`, `audit_status`, `audit_note`, `created_by_id`, `created_by`, `recorded_at`, `voided_at`, `voided_by`, `void_reason`) VALUES
(1, 'c0583b2c-55a6-4031-af6f-3e94e045a748', 1, '2026-10-15', 'advance', '', '', '', 'Cash advance for the Acquintance', 12000.00, NULL, 'pending', '', 3, 'auditor', '2026-10-15 20:23:15', '2026-10-15 20:47:22', 'auditor', 'redundant'),
(2, 'ee164cd7-59fb-41e4-836d-5b1104a966b4', 1, '2026-10-15', 'disbursement', '123124', '12312124', 'N/A', 'ASSORTED BREAD', 2000.00, NULL, 'pending', '', 3, 'auditor', '2026-10-15 20:25:26', '2026-10-15 20:47:26', 'auditor', 'redundant'),
(3, '5dbbc935-39e0-440d-b4ac-5be86c78afaf', 2, '2026-09-11', 'advance', '', '', '', 'Cash advance for the SALUDO COMPETITION on September 15, 2026', 91720.00, NULL, 'pending', '', 3, 'auditor', '2026-10-15 20:51:47', NULL, NULL, NULL),
(4, 'be833b18-fdee-47e1-a6ba-474305cd0ae4', 2, '2026-08-31', 'disbursement', '', '', 'JJ BAKERY', 'ASSORTED BREAD\r\nPLETE', 1100.00, NULL, 'pending', '', 3, 'auditor', '2026-10-15 20:51:47', NULL, NULL, NULL),
(5, '92fccb2a-54a0-40ac-9d57-6cd2f30e6620', 2, '2026-09-01', 'disbursement', '', '', 'ACEDRE STORE', 'COOKING OIL', 100.00, NULL, 'pending', '', 3, 'auditor', '2026-10-15 21:08:40', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `auditor_receipt_sheets`
--

CREATE TABLE `auditor_receipt_sheets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `event_title` varchar(200) NOT NULL,
  `sheet_no` varchar(30) NOT NULL DEFAULT '1',
  `created_by_id` int(11) NOT NULL,
  `created_by` varchar(150) NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auditor_receipt_sheets`
--

INSERT INTO `auditor_receipt_sheets` (`id`, `event_title`, `sheet_no`, `created_by_id`, `created_by`, `created_at`) VALUES
(1, 'Aquintance', '1', 3, 'auditor', '2026-10-15 19:58:33'),
(2, 'General audit register', 'direct-entry-v7', 3, 'auditor', '2026-10-15 20:51:47');

-- --------------------------------------------------------

--
-- Table structure for table `budgets`
--

CREATE TABLE `budgets` (
  `item_key` varchar(100) NOT NULL,
  `allocated_amount` decimal(15,2) DEFAULT 0.00,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `academic_year` varchar(20) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `budgets`
--

INSERT INTO `budgets` (`item_key`, `allocated_amount`, `is_archived`, `academic_year`, `updated_at`) VALUES
('exp-1791480833999-sound-system', 10000.00, 0, NULL, '2026-10-08 17:36:32'),
('exp-1791480833999-venue', 10000.00, 0, NULL, '2026-10-08 17:36:32'),
('exp-d96726b6-46ee-4c59-966b-696f51a50bfd-sound-system', 10000.00, 0, NULL, '2026-10-21 11:14:08');

-- --------------------------------------------------------

--
-- Table structure for table `collections`
--

CREATE TABLE `collections` (
  `id` int(11) NOT NULL,
  `item_key` varchar(100) NOT NULL,
  `category_data` text DEFAULT NULL,
  `merch` decimal(15,2) DEFAULT 0.00,
  `tickets` decimal(15,2) DEFAULT 0.00,
  `penalties` decimal(15,2) DEFAULT 0.00,
  `other` decimal(15,2) DEFAULT 0.00,
  `remarks` text DEFAULT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `academic_year` varchar(20) DEFAULT NULL,
  `num_students` int(11) DEFAULT NULL,
  `category_snapshot` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `label` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `collections`
--

INSERT INTO `collections` (`id`, `item_key`, `category_data`, `merch`, `tickets`, `penalties`, `other`, `remarks`, `is_archived`, `academic_year`, `num_students`, `category_snapshot`, `updated_at`, `label`) VALUES
(8759, 'dept-1787218659674-1-section-a', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":800}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:53:20', 'Department of Information Technology 1-A'),
(8770, 'dept-1787218659674-1-section-b', '{\"cat_1778665291061\":19280,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, 'Fully Paid', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-10-08 17:33:02', 'Department of Information Technology 1-B'),
(8803, 'dept-1787218659674-1-section-c', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:46:58', 'Department of Information Technology 1-C'),
(8834, 'dept-1787218659674-1-section-d', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:46:58', 'Department of Information Technology 1-D'),
(9747, 'dept-1787221083362-1-section-a', '{\"cat_1778665291061\":\"200.00\",\"cat_1790598452525\":\"150.00\",\"cat_1791480607992\":\"30.00\"}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 23 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 13:24:49', 'BS in Information Technology 1-A'),
(9749, 'dept-1787221083362-2-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Information Technology 2-A'),
(9752, 'dept-1787221083362-3-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Information Technology 3-A'),
(9756, 'dept-1787221083362-4-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Information Technology 4-A'),
(9765, 'dept-1787221099091-1-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Computer Science 1-A'),
(9771, 'dept-1787221099091-2-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Computer Science 2-A'),
(9778, 'dept-1787221099091-3-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Computer Science 3-A'),
(9786, 'dept-1787221099091-4-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Computer Science 4-A'),
(9795, 'dept-1787221127005-1-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Library and Information Science 1-A'),
(9805, 'dept-1787221127005-2-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Library and Information Science 2-A'),
(9816, 'dept-1787221127005-3-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Library and Information Science 3-A'),
(9828, 'dept-1787221127005-4-section-a', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Library and Information Science 4-A'),
(9842, 'dept-1787221083362-1-section-b', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:33', 'BS in Information Technology 1-B'),
(9882, 'dept-1787221083362-1-section-c', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:33', 'BS in Information Technology 1-C'),
(10835, 'dept-1787221083362-1-section-d', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:33', 'BS in Information Technology 1-D'),
(21421, 'dept-1787221083362-2-section-b', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Information Technology 2-B'),
(21422, 'dept-1787221083362-2-section-c', '{}', 0.00, 0.00, 0.00, 0.00, '24 unpaid T-SHIRT, 24 unpaid INTRAMS, 24 unpaid FOODS', 0, NULL, NULL, NULL, '2026-10-23 12:57:34', 'BS in Information Technology 2-C');

-- --------------------------------------------------------

--
-- Table structure for table `conversations`
--

CREATE TABLE `conversations` (
  `id` int(11) NOT NULL,
  `is_group` tinyint(1) NOT NULL DEFAULT 0,
  `title` varchar(150) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `conversations`
--

INSERT INTO `conversations` (`id`, `is_group`, `title`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'Officers | 2026-2027', 1, '2026-08-23 09:36:01', '2026-08-23 09:36:01'),
(2, 0, NULL, 1, '2026-08-23 09:36:10', '2026-08-23 09:37:56'),
(3, 0, NULL, 1, '2026-08-23 09:37:00', '2026-08-23 09:37:00');

-- --------------------------------------------------------

--
-- Table structure for table `conversation_participants`
--

CREATE TABLE `conversation_participants` (
  `id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `last_read_message_id` int(11) DEFAULT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `conversation_participants`
--

INSERT INTO `conversation_participants` (`id`, `conversation_id`, `user_id`, `last_read_message_id`, `joined_at`) VALUES
(1, 1, 1, 1, '2026-08-23 09:36:01'),
(2, 1, 3, 1, '2026-08-23 09:36:01'),
(3, 1, 2, 1, '2026-08-23 09:36:01'),
(4, 2, 1, 5, '2026-08-23 09:36:10'),
(5, 2, 2, 5, '2026-08-23 09:36:10'),
(6, 3, 1, 3, '2026-08-23 09:37:00'),
(7, 3, 3, 3, '2026-08-23 09:37:00');

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `upload_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `uploaded_by_id` int(11) DEFAULT NULL,
  `uploaded_by` varchar(100) DEFAULT NULL,
  `uploaded_by_role` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `documents`
--

INSERT INTO `documents` (`id`, `name`, `category`, `file_path`, `upload_date`, `uploaded_by_id`, `uploaded_by`, `uploaded_by_role`) VALUES
(10, 'Sound System Receipt', 'Sound System', 'uploads/1791482779_sana_twice_with_youth_kpop_125_1_o_thumb.jpg', '2026-10-08 18:06:19', 2, 'treasurer', 'treasurer'),
(11, 'Venue Receipt', 'Venue', 'uploads/1791524758_dahyun_twice_with_youth_kpop_120_1_o_thumb.jpg', '2026-10-09 05:45:58', 2, 'treasurer', 'treasurer');

-- --------------------------------------------------------

--
-- Table structure for table `expenditures`
--

CREATE TABLE `expenditures` (
  `id` int(11) NOT NULL,
  `item_key` varchar(100) NOT NULL,
  `amount` decimal(15,2) DEFAULT 0.00,
  `remarks` text DEFAULT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `academic_year` varchar(20) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `label` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `expenditures`
--

INSERT INTO `expenditures` (`id`, `item_key`, `amount`, `remarks`, `is_archived`, `academic_year`, `updated_at`, `label`) VALUES
(1, 'evt-or-venue---equipment', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(2, 'evt-or-food---meals', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(3, 'evt-or-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(4, 'evt-acq-venue---equipment', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(5, 'evt-acq-food---meals', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(6, 'evt-acq-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(7, 'evt-td-tokens---gifts', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(8, 'evt-td-food---meals', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(9, 'evt-td-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(10, 'evt-int-sports-equipment', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(11, 'evt-int-water---supplies', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(12, 'evt-int-jersey-shirt', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(13, 'evt-int-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(14, 'evt-cics-event-materials', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(15, 'evt-cics-prizes---awards', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(16, 'evt-cics-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(17, 'evt-fd-booth-materials', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(18, 'evt-fd-food---meals', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(19, 'evt-fd-sounds', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(20, 'evt-other-activity---seminar-expenses', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(21, 'evt-other-miscellaneous-requirements', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(6260, 'exp-1778736017324-penalty', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(6874, 'evt-acq-tokens---gifts', 0.00, '', 1, '2025-2026', '2026-05-27 07:22:49', NULL),
(7272, 'exp-1779867498682-foods', 0.00, '', 1, '3030-3031', '2026-05-27 07:39:37', NULL),
(7291, 'exp-1779867498682-venue', 0.00, '', 1, '3030-3031', '2026-05-27 07:39:37', NULL),
(7345, 'exp-1779867498682-sound-system', 0.00, '', 1, '3030-3031', '2026-05-27 07:39:37', NULL),
(7350, 'exp-1779871391220-foods', 0.00, '', 1, '2026-2027', '2026-08-15 06:42:21', NULL),
(7359, 'exp-1779871391220-venue', 0.00, '', 1, '2026-2027', '2026-08-15 06:42:21', NULL),
(7425, 'exp-1779871391220-sound-system', 0.00, '', 1, '2026-2027', '2026-08-15 06:42:21', NULL),
(7523, 'exp-1786776255064-foods', 0.00, '', 1, '2026-2027', '2026-08-15 06:47:27', NULL),
(7536, 'exp-1791480833999-sound-system', 11000.00, '', 0, NULL, '2026-10-08 17:37:12', 'Orientation Sound System'),
(7540, 'exp-1791480833999-venue', 10000.00, '', 0, NULL, '2026-10-21 14:53:41', 'Orientation Venue'),
(8525, 'exp-d96726b6-46ee-4c59-966b-696f51a50bfd-sound-system', 10000.00, '', 0, NULL, '2026-10-21 11:09:40', 'CICS WEEK Sound System');

-- --------------------------------------------------------

--
-- Table structure for table `late_payments`
--

CREATE TABLE `late_payments` (
  `id` int(11) NOT NULL,
  `academic_year` varchar(20) NOT NULL,
  `item_key` varchar(100) NOT NULL,
  `student_name` varchar(150) NOT NULL,
  `category_key` varchar(100) DEFAULT NULL,
  `category_name` varchar(150) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remarks` text DEFAULT NULL,
  `processed_by` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `late_payments`
--

INSERT INTO `late_payments` (`id`, `academic_year`, `item_key`, `student_name`, `category_key`, `category_name`, `amount`, `remarks`, `processed_by`, `created_at`) VALUES
(2, '2026-2027', 'dept-1786776238925-1-a', 'Jim Lloyd Barredo', 'cat_1778665291061', 'T-SHIRT', 500.00, 'paid in cash', 'admin', '2026-08-15 06:49:33'),
(5, '2026-2027', 'UNPAID-SUMMARY-1786777776', 'Jim Lloyd Barredo', 'cat_1778665291061', 'T-SHIRT', 500.00, 'pd', 'admin', '2026-08-20 08:50:28'),
(6, '2026-2027', 'dept-1779868226624-1-section-a', 'JIM', 'cat_1778665291061', 'T-SHIRT', 500.00, NULL, 'admin', '2026-08-20 08:51:21'),
(7, '2026-2027', 'dept-1787217822184-1-a', 'Jim Lloyd Barredo', 'cat_1778665291061', 'T-SHIRT', 500.00, 'pd', 'admin', '2026-08-20 09:26:19'),
(8, '2026-2027', 'dept-1787218007569-1-a', 'Jim Lloyd Barredo', 'cat_1778665291061', 'T-SHIRT', 500.00, 'pd', 'admin', '2026-08-20 09:28:30'),
(9, '2027-2028', 'dept-1787218659674-1-section-a', 'John Rosswern Agustin Bensurto', 'cat_1787219100769', 'Gay Tax', 10.00, 'pd', 'admin', '2026-08-20 09:53:20'),
(10, '2027-2028', 'dept-1787218659674-1-section-b', 'Gladys Feliciano', 'cat_1778665291061', 'T-SHIRT', 480.00, 'pd', 'admin', '2026-10-08 17:33:02');

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `sender_username` varchar(50) NOT NULL,
  `body` text NOT NULL,
  `is_edited` tinyint(1) NOT NULL DEFAULT 0,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `edited_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `conversation_id`, `sender_id`, `sender_username`, `body`, `is_edited`, `is_deleted`, `edited_at`, `created_at`) VALUES
(1, 1, 1, 'admin', 'oY', 0, 0, NULL, '2026-08-23 09:36:01'),
(2, 2, 1, 'admin', 'wheres the report', 0, 0, NULL, '2026-08-23 09:36:10'),
(3, 3, 1, 'admin', 'oy', 0, 0, NULL, '2026-08-23 09:37:00'),
(4, 2, 2, 'treasurer', 'ill send it to you later', 0, 0, NULL, '2026-08-23 09:37:45'),
(5, 2, 2, 'treasurer', 'i mean drop by', 0, 0, NULL, '2026-08-23 09:37:56');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'message',
  `title` varchar(150) NOT NULL,
  `body` varchar(255) DEFAULT NULL,
  `conversation_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `body`, `conversation_id`, `is_read`, `created_at`) VALUES
(1, 2, 'message', 'New message from admin', 'oY', 1, 1, '2026-08-23 09:36:01'),
(2, 3, 'message', 'New message from admin', 'oY', 1, 1, '2026-08-23 09:36:01'),
(3, 2, 'message', 'New message from admin', 'wheres the report', 2, 1, '2026-08-23 09:36:10'),
(4, 3, 'message', 'New message from admin', 'oy', 3, 1, '2026-08-23 09:37:00'),
(5, 1, 'message', 'New message from treasurer', 'ill send it to you later', 2, 1, '2026-08-23 09:37:45'),
(6, 1, 'message', 'New message from treasurer', 'i mean drop by', 2, 1, '2026-08-23 09:37:56'),
(7, 1, 'password_reset', 'Password reset requested', 'Auditor · Auditor User (auditor) · Request #1', NULL, 1, '2026-10-15 06:11:53'),
(8, 1, 'password_reset', 'Password reset requested', 'Auditor · Auditor User (auditor) · Request #2', NULL, 1, '2026-10-18 17:01:54');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_rate_limits`
--

CREATE TABLE `password_reset_rate_limits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `ip_hash` char(64) NOT NULL,
  `attempted_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `password_reset_rate_limits`
--

INSERT INTO `password_reset_rate_limits` (`id`, `ip_hash`, `attempted_at`) VALUES
(1, 'eff8e7ca506627fe15dda5e0e512fcaad70b6d520f37cc76597fdb4f2d83a1a3', '2026-10-15 02:11:53'),
(2, 'eff8e7ca506627fe15dda5e0e512fcaad70b6d520f37cc76597fdb4f2d83a1a3', '2026-10-18 13:01:54');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_requests`
--

CREATE TABLE `password_reset_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('pending','approved','denied','completed','expired') NOT NULL DEFAULT 'pending',
  `requested_at` datetime NOT NULL DEFAULT current_timestamp(),
  `decided_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `code_hash` char(64) DEFAULT NULL,
  `code_expires_at` datetime DEFAULT NULL,
  `failed_attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `completed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `password_reset_requests`
--

INSERT INTO `password_reset_requests` (`id`, `user_id`, `status`, `requested_at`, `decided_at`, `approved_by`, `code_hash`, `code_expires_at`, `failed_attempts`, `completed_at`) VALUES
(1, 3, 'completed', '2026-10-15 02:11:53', '2026-10-15 02:12:47', 1, NULL, '2026-10-15 02:42:47', 0, '2026-10-15 02:13:46'),
(2, 3, 'completed', '2026-10-18 13:01:54', '2026-10-18 13:02:10', 1, NULL, '2026-10-18 13:32:10', 0, '2026-10-18 13:03:05');

-- --------------------------------------------------------

--
-- Table structure for table `recovered_school_years`
--

CREATE TABLE `recovered_school_years` (
  `school_year` varchar(9) NOT NULL,
  `source_snapshot` longtext NOT NULL,
  `working_data` longtext NOT NULL,
  `revision` bigint(20) UNSIGNED NOT NULL DEFAULT 1,
  `recovered_by` varchar(200) NOT NULL,
  `recovered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recovered_school_years`
--

INSERT INTO `recovered_school_years` (`school_year`, `source_snapshot`, `working_data`, `revision`, `recovered_by`, `recovered_at`, `updated_at`) VALUES
('2027-2028', '{\"schema\":1,\"school_year\":\"2027-2028\",\"structure\":[],\"subcategories\":[],\"category_unpaid_lists\":[],\"limitations\":[\"This older archive has no saved layout or Admin subcategory snapshot. Its available financial records are recovered below.\"],\"collections\":[{\"id\":8759,\"item_key\":\"dept-1787218659674-1-section-a\",\"category_data\":\"{\\\"cat_1778665291061\\\":18800,\\\"cat_1787219100769\\\":800}\",\"merch\":\"0.00\",\"tickets\":\"0.00\",\"penalties\":\"0.00\",\"other\":\"0.00\",\"remarks\":\"1 unpaid T-SHIRT\",\"is_archived\":1,\"academic_year\":\"2027-2028\",\"num_students\":40,\"category_snapshot\":\"[{\\\"id\\\":\\\"cat_1778665291061\\\",\\\"name\\\":\\\"T-SHIRT\\\",\\\"price\\\":480},{\\\"id\\\":\\\"cat_1787219100769\\\",\\\"name\\\":\\\"Gay Tax\\\",\\\"price\\\":10}]\",\"updated_at\":\"2026-08-20 05:53:20\",\"label\":\"Department of Information Technology 1-A\"},{\"id\":8770,\"item_key\":\"dept-1787218659674-1-section-b\",\"category_data\":\"{\\\"cat_1778665291061\\\":19280,\\\"cat_1787219100769\\\":790}\",\"merch\":\"0.00\",\"tickets\":\"0.00\",\"penalties\":\"0.00\",\"other\":\"0.00\",\"remarks\":\"Fully Paid\",\"is_archived\":1,\"academic_year\":\"2027-2028\",\"num_students\":40,\"category_snapshot\":\"[{\\\"id\\\":\\\"cat_1778665291061\\\",\\\"name\\\":\\\"T-SHIRT\\\",\\\"price\\\":480},{\\\"id\\\":\\\"cat_1787219100769\\\",\\\"name\\\":\\\"Gay Tax\\\",\\\"price\\\":10}]\",\"updated_at\":\"2026-10-08 13:33:02\",\"label\":\"Department of Information Technology 1-B\"},{\"id\":8803,\"item_key\":\"dept-1787218659674-1-section-c\",\"category_data\":\"{\\\"cat_1778665291061\\\":18800,\\\"cat_1787219100769\\\":790}\",\"merch\":\"0.00\",\"tickets\":\"0.00\",\"penalties\":\"0.00\",\"other\":\"0.00\",\"remarks\":\"1 unpaid T-SHIRT\",\"is_archived\":1,\"academic_year\":\"2027-2028\",\"num_students\":40,\"category_snapshot\":\"[{\\\"id\\\":\\\"cat_1778665291061\\\",\\\"name\\\":\\\"T-SHIRT\\\",\\\"price\\\":480},{\\\"id\\\":\\\"cat_1787219100769\\\",\\\"name\\\":\\\"Gay Tax\\\",\\\"price\\\":10}]\",\"updated_at\":\"2026-08-20 05:46:58\",\"label\":\"Department of Information Technology 1-C\"},{\"id\":8834,\"item_key\":\"dept-1787218659674-1-section-d\",\"category_data\":\"{\\\"cat_1778665291061\\\":18800,\\\"cat_1787219100769\\\":790}\",\"merch\":\"0.00\",\"tickets\":\"0.00\",\"penalties\":\"0.00\",\"other\":\"0.00\",\"remarks\":\"1 unpaid T-SHIRT\",\"is_archived\":1,\"academic_year\":\"2027-2028\",\"num_students\":40,\"category_snapshot\":\"[{\\\"id\\\":\\\"cat_1778665291061\\\",\\\"name\\\":\\\"T-SHIRT\\\",\\\"price\\\":480},{\\\"id\\\":\\\"cat_1787219100769\\\",\\\"name\\\":\\\"Gay Tax\\\",\\\"price\\\":10}]\",\"updated_at\":\"2026-08-20 05:46:58\",\"label\":\"Department of Information Technology 1-D\"}],\"expenditures\":[],\"budgets\":[],\"unpaid_students\":[{\"id\":4,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-b\",\"student_name\":\"Gladys Feliciano\",\"category_key\":\"cat_1778665291061\",\"category_name\":\"T-SHIRT\",\"remarks\":null,\"is_settled\":1,\"settled_payment_id\":10,\"recorded_by\":\"admin\",\"created_at\":\"2026-08-20 05:46:58\",\"settled_at\":\"2026-10-08 13:33:02\"},{\"id\":5,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-a\",\"student_name\":\"John Rosswern Agustin Bensurto\",\"category_key\":\"cat_1787219100769\",\"category_name\":\"Gay Tax\",\"remarks\":\"Gay\",\"is_settled\":1,\"settled_payment_id\":9,\"recorded_by\":\"admin\",\"created_at\":\"2026-08-20 05:46:58\",\"settled_at\":\"2026-08-20 05:53:20\"}],\"late_payments\":[{\"id\":9,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-a\",\"student_name\":\"John Rosswern Agustin Bensurto\",\"category_key\":\"cat_1787219100769\",\"category_name\":\"Gay Tax\",\"amount\":\"10.00\",\"remarks\":\"pd\",\"processed_by\":\"admin\",\"created_at\":\"2026-08-20 05:53:20\"},{\"id\":10,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-b\",\"student_name\":\"Gladys Feliciano\",\"category_key\":\"cat_1778665291061\",\"category_name\":\"T-SHIRT\",\"amount\":\"480.00\",\"remarks\":\"pd\",\"processed_by\":\"admin\",\"created_at\":\"2026-10-08 13:33:02\"}],\"history\":{\"collections\":[],\"expenditures\":[],\"remittances\":[]}}', '{\"schema\":1,\"school_year\":\"2027-2028\",\"categories\":[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":\"480.00\"},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":\"10.00\"}],\"subcategories\":[],\"collections\":[{\"key\":\"dept-1787218659674-1-section-a\",\"label\":\"Department of Information Technology 1-A\",\"students\":40,\"amounts\":{\"cat_1778665291061\":\"18800.00\",\"cat_1787219100769\":\"800.00\"},\"remarks\":\"1 unpaid T-SHIRT\"},{\"key\":\"dept-1787218659674-1-section-b\",\"label\":\"Department of Information Technology 1-B\",\"students\":40,\"amounts\":{\"cat_1778665291061\":\"19280.00\",\"cat_1787219100769\":\"790.00\"},\"remarks\":\"Fully Paid\"},{\"key\":\"dept-1787218659674-1-section-c\",\"label\":\"Department of Information Technology 1-C\",\"students\":40,\"amounts\":{\"cat_1778665291061\":\"18800.00\",\"cat_1787219100769\":\"790.00\"},\"remarks\":\"1 unpaid T-SHIRT\"},{\"key\":\"dept-1787218659674-1-section-d\",\"label\":\"Department of Information Technology 1-D\",\"students\":40,\"amounts\":{\"cat_1778665291061\":\"18800.00\",\"cat_1787219100769\":\"790.00\"},\"remarks\":\"1 unpaid T-SHIRT\"}],\"expenditures\":[],\"unpaid_students\":[{\"id\":4,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-b\",\"student_name\":\"Gladys Feliciano\",\"category_key\":\"cat_1778665291061\",\"category_name\":\"T-SHIRT\",\"remarks\":null,\"is_settled\":1,\"settled_payment_id\":10,\"recorded_by\":\"admin\",\"created_at\":\"2026-08-20 05:46:58\",\"settled_at\":\"2026-10-08 13:33:02\"},{\"id\":5,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-a\",\"student_name\":\"John Rosswern Agustin Bensurto\",\"category_key\":\"cat_1787219100769\",\"category_name\":\"Gay Tax\",\"remarks\":\"Gay\",\"is_settled\":1,\"settled_payment_id\":9,\"recorded_by\":\"admin\",\"created_at\":\"2026-08-20 05:46:58\",\"settled_at\":\"2026-08-20 05:53:20\"}],\"late_payments\":[{\"id\":9,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-a\",\"student_name\":\"John Rosswern Agustin Bensurto\",\"category_key\":\"cat_1787219100769\",\"category_name\":\"Gay Tax\",\"amount\":\"10.00\",\"remarks\":\"pd\",\"processed_by\":\"admin\",\"created_at\":\"2026-08-20 05:53:20\"},{\"id\":10,\"academic_year\":\"2027-2028\",\"item_key\":\"dept-1787218659674-1-section-b\",\"student_name\":\"Gladys Feliciano\",\"category_key\":\"cat_1778665291061\",\"category_name\":\"T-SHIRT\",\"amount\":\"480.00\",\"remarks\":\"pd\",\"processed_by\":\"admin\",\"created_at\":\"2026-10-08 13:33:02\"}],\"structure\":[],\"history\":{\"collections\":[],\"expenditures\":[],\"remittances\":[]},\"limitations\":[\"This older archive has no saved layout or Admin subcategory snapshot. Its available financial records are recovered below.\"]}', 1, 'admin', '2026-10-18 18:56:08', '2026-10-18 18:56:08');

-- --------------------------------------------------------

--
-- Table structure for table `recovered_year_activity`
--

CREATE TABLE `recovered_year_activity` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `school_year` varchar(9) NOT NULL,
  `username` varchar(200) NOT NULL,
  `actor_role` varchar(30) NOT NULL,
  `action` varchar(80) NOT NULL,
  `details` longtext NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `recovered_year_activity`
--

INSERT INTO `recovered_year_activity` (`id`, `school_year`, `username`, `actor_role`, `action`, `details`, `recorded_at`) VALUES
(1, '2027-2028', 'admin', 'admin', 'School Year Recovered', '{\"source\":\"Separate copy of archived records; current-year tables unchanged.\"}', '2026-10-18 18:56:08');

-- --------------------------------------------------------

--
-- Table structure for table `school_year_snapshots`
--

CREATE TABLE `school_year_snapshots` (
  `school_year` varchar(9) NOT NULL,
  `snapshot_json` longtext NOT NULL,
  `captured_by` varchar(200) NOT NULL,
  `captured_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `section_remittances`
--

CREATE TABLE `section_remittances` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `request_id` char(36) NOT NULL,
  `cycle_id` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `item_key` varchar(100) NOT NULL,
  `section_label` varchar(600) NOT NULL,
  `direction` varchar(20) NOT NULL,
  `date_remitted` date NOT NULL,
  `remitted_by` varchar(150) NOT NULL,
  `received_by` varchar(150) NOT NULL,
  `category_data` longtext NOT NULL,
  `category_names` longtext NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `reference_no` varchar(100) NOT NULL DEFAULT '',
  `note` varchar(500) NOT NULL DEFAULT '',
  `recorded_by_id` int(11) NOT NULL,
  `recorded_by` varchar(150) NOT NULL,
  `encoded_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `section_remittances`
--

INSERT INTO `section_remittances` (`id`, `request_id`, `cycle_id`, `item_key`, `section_label`, `direction`, `date_remitted`, `remitted_by`, `received_by`, `category_data`, `category_names`, `amount`, `reference_no`, `note`, `recorded_by_id`, `recorded_by`, `encoded_at`) VALUES
(10, '5a43678d-f5ee-4b8a-812f-031dc620a231', 47, 'dept-1787221083362-1-section-a', 'BS in Information Technology / 1st Year Sections / Section A', 'classroom', '2026-10-23', 'John Rosswern Bensurto', 'AJ Igbacol', '{\"cat_1778665291061\":\"200.00\",\"cat_1790598452525\":\"150.00\"}', '{\"cat_1778665291061\":\"T-SHIRT\",\"cat_1790598452525\":\"INTRAMS\"}', 350.00, '', '', 2, 'treasurer', '2026-10-23 21:21:30'),
(11, '83bd8900-84b3-44cd-bc23-24e51b93d384', 47, 'dept-1787221083362-1-section-a', 'BS in Information Technology / 1st Year Sections / Section A', 'classroom', '2026-10-23', 'John Rosswern Bensurto', 'AJ Igbacol', '{\"cat_1791480607992\":\"30.00\"}', '{\"cat_1791480607992\":\"FOODS\"}', 30.00, '', '', 2, 'treasurer', '2026-10-23 21:24:48');

-- --------------------------------------------------------

--
-- Table structure for table `section_settings`
--

CREATE TABLE `section_settings` (
  `section_key` varchar(50) NOT NULL,
  `num_students` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `section_settings`
--

INSERT INTO `section_settings` (`section_key`, `num_students`) VALUES
('cs-1-section-a', 0),
('cs-1-section-b', 0),
('cs-2-section-a', 0),
('cs-2-section-b', 0),
('cs-3-section-a', 0),
('cs-3-section-b', 0),
('cs-4-section-a', 0),
('cs-4-section-b', 0),
('dept-1786776238925-1-a', 20),
('dept-1786776238925-1-b', 0),
('dept-1786777673270-1-a', 10),
('dept-1787217822184-1-a', 24),
('dept-1787218007569-1-a', 10),
('dept-1787218659674-1-section-a', 40),
('dept-1787218659674-1-section-b', 40),
('dept-1787218659674-1-section-c', 40),
('dept-1787218659674-1-section-d', 40),
('dept-1787221083362-1-section-a', 24),
('dept-1787221083362-1-section-b', 24),
('dept-1787221083362-1-section-c', 24),
('dept-1787221083362-1-section-d', 24),
('dept-1787221083362-2-section-a', 24),
('dept-1787221083362-2-section-b', 24),
('dept-1787221083362-2-section-c', 24),
('dept-1787221083362-3-section-a', 24),
('dept-1787221083362-4-section-a', 24),
('dept-1787221099091-1-section-a', 24),
('dept-1787221099091-2-section-a', 24),
('dept-1787221099091-3-section-a', 24),
('dept-1787221099091-4-section-a', 24),
('dept-1787221127005-1-section-a', 24),
('dept-1787221127005-2-section-a', 24),
('dept-1787221127005-3-section-a', 24),
('dept-1787221127005-4-section-a', 24),
('it-1-section-a', 40),
('it-1-section-b', 40),
('it-1-section-c', 40),
('it-1-section-d', 40),
('it-2-section-a', 0),
('it-2-section-b', 0),
('it-2-section-c', 0),
('it-3-section-a', 0),
('it-3-section-b', 0),
('it-3-section-c', 0),
('it-4-section-a', 0),
('it-4-section-b', 0),
('it-4-section-c', 0),
('lis-1-section-a', 0),
('lis-2-section-a', 0),
('lis-3-section-a', 0);

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
('admin_category_subcategories', '{\"cat_1790598452525\":[{\"name\":\"Foods\",\"price\":\"50.00\"},{\"name\":\"Athlete\",\"price\":\"50.00\"},{\"name\":\"Jersey\",\"price\":\"50.00\"}]}'),
('audit_edit_2b513d13-0979-4db1-842d-050ca5557c83', '1'),
('audit_edit_4ac54f37-9ac1-4624-8179-9f6ef28dee53', '2'),
('audit_edit_4aef7fd1-d673-48cf-bf8c-7a7ae8b1344f', '1'),
('audit_edit_7f970450-89a8-4125-ba2e-afefb00fcb9f', '5'),
('audit_edit_8740ce03-838d-4e7a-9b9e-d25c129fe66a', '1'),
('audit_edit_d61e61d2-7561-408e-896d-7e92438db798', '2'),
('audit_edit_e7d79c98-397b-48a4-b8e9-13a14cc77075', '5'),
('collection_categories', '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":\"500.00\"},{\"id\":\"cat_1790598452525\",\"name\":\"INTRAMS\",\"price\":\"150.00\"},{\"id\":\"cat_1791480607992\",\"name\":\"FOODS\",\"price\":\"50.00\"}]'),
('expenditure_overall_budget', '{\"cycle\":47,\"amount\":\"50000.00\"}'),
('report_signatories', '{\"prepared\":{\"name\":\"\",\"position\":\"Organization Treasurer\"},\"certified\":{\"name\":\"\",\"position\":\"Organization President\"},\"noted\":{\"name\":\"\",\"position\":\"Organization Adviser\"},\"approved\":{\"name\":\"\",\"position\":\"College Dean\"}}'),
('ui_layout', '{\"collections\":[{\"type\":\"toggle\",\"name\":\"BS in Information Technology\",\"id\":\"dept-1787221083362\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221083362-1\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section B\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section C\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section D\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221083362-2\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-2\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section B\",\"parent\":\"dept-1787221083362-2\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section C\",\"parent\":\"dept-1787221083362-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221083362-3\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221083362-4\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-4\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"BS in Computer Science\",\"id\":\"dept-1787221099091\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221099091-1\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221099091-2\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221099091-3\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221099091-4\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-4\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"BS in Library and Information Science\",\"id\":\"dept-1787221127005\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221127005-1\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221127005-2\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221127005-3\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221127005-4\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-4\",\"depth\":2}],\"expenditures\":[{\"type\":\"toggle\",\"name\":\"Orientation\",\"id\":\"exp-1791480833999\",\"depth\":0,\"start_date\":\"\",\"end_date\":\"\"},{\"type\":\"out\",\"name\":\"Sound System\",\"parent\":\"exp-1791480833999\",\"depth\":1,\"start_date\":\"\",\"end_date\":\"\"},{\"type\":\"out\",\"name\":\"Venue\",\"parent\":\"exp-1791480833999\",\"depth\":1,\"start_date\":\"\",\"end_date\":\"\"},{\"type\":\"toggle\",\"name\":\"CICS WEEK\",\"id\":\"exp-d96726b6-46ee-4c59-966b-696f51a50bfd\",\"depth\":0,\"start_date\":\"\",\"end_date\":\"\"},{\"type\":\"out\",\"name\":\"Sound System\",\"parent\":\"exp-d96726b6-46ee-4c59-966b-696f51a50bfd\",\"depth\":1,\"start_date\":\"\",\"end_date\":\"\"}]}'),
('unpaid_roster_15c34c0d57db31cc805bba78386ebe8b', '{\"names\":[\"John Rosswern Bensurto\"],\"entries\":[{\"student_name\":\"John Rosswern Bensurto\",\"payment_date\":\"2026-10-23\",\"amount_paid\":\"30.00\",\"fee_amount\":\"50.00\",\"balance_due\":\"20.00\"}],\"_collection_link\":{\"version\":1,\"pending_cents\":0,\"clear_id\":262},\"category_name\":\"FOODS\",\"updated_by\":\"treasurer\",\"updated_at\":\"2026-10-23T13:24:39+00:00\"}'),
('unpaid_roster_c7276f09d82ba26b788ea94f1b416d54', '{\"names\":[\"John Rosswern Bensurto\",\"Jim Lloyd Barredo\"],\"entries\":[{\"student_name\":\"John Rosswern Bensurto\",\"payment_date\":\"2026-10-23\",\"amount_paid\":\"100.00\",\"fee_amount\":\"150.00\",\"balance_due\":\"50.00\"},{\"student_name\":\"Jim Lloyd Barredo\",\"payment_date\":\"2026-10-23\",\"amount_paid\":\"50.00\",\"fee_amount\":\"150.00\",\"balance_due\":\"100.00\"}],\"_collection_link\":{\"version\":1,\"pending_cents\":0,\"clear_id\":262},\"category_name\":\"INTRAMS\",\"updated_by\":\"treasurer\",\"updated_at\":\"2026-10-23T13:20:29+00:00\"}'),
('unpaid_roster_c7276f09d82ba26b788ea94f1b416d549790', ''),
('unpaid_roster_cad68954b045a8f4981f190a04b0a0b9', '{\"names\":[\"Jim Lloyd Barredo\",\"John Rosswern Bensurto\"],\"entries\":[{\"student_name\":\"Jim Lloyd Barredo\",\"payment_date\":\"2026-10-23\",\"amount_paid\":\"200.00\",\"fee_amount\":\"500.00\",\"balance_due\":\"300.00\"},{\"student_name\":\"John Rosswern Bensurto\",\"payment_date\":\"2026-10-23\",\"amount_paid\":\"0.00\",\"fee_amount\":\"500.00\",\"balance_due\":\"500.00\"}],\"_collection_link\":{\"version\":1,\"pending_cents\":0,\"clear_id\":262},\"category_name\":\"T-SHIRT\",\"updated_by\":\"treasurer\",\"updated_at\":\"2026-10-23T13:19:28+00:00\"}'),
('unpaid_roster_cad68954b045a8f4981f190a04b0a0b96129', ''),
('user_theme_1', 'light'),
('user_theme_2', 'light'),
('user_theme_3', 'light');

-- --------------------------------------------------------

--
-- Table structure for table `unpaid_students`
--

CREATE TABLE `unpaid_students` (
  `id` int(11) NOT NULL,
  `academic_year` varchar(20) NOT NULL,
  `item_key` varchar(100) NOT NULL,
  `student_name` varchar(150) NOT NULL,
  `category_key` varchar(100) DEFAULT NULL,
  `category_name` varchar(150) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `is_settled` tinyint(1) NOT NULL DEFAULT 0,
  `settled_payment_id` int(11) DEFAULT NULL,
  `recorded_by` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `settled_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `unpaid_students`
--

INSERT INTO `unpaid_students` (`id`, `academic_year`, `item_key`, `student_name`, `category_key`, `category_name`, `remarks`, `is_settled`, `settled_payment_id`, `recorded_by`, `created_at`, `settled_at`) VALUES
(4, '2027-2028', 'dept-1787218659674-1-section-b', 'Gladys Feliciano', 'cat_1778665291061', 'T-SHIRT', NULL, 1, 10, 'admin', '2026-08-20 09:46:58', '2026-10-08 17:33:02'),
(5, '2027-2028', 'dept-1787218659674-1-section-a', 'John Rosswern Agustin Bensurto', 'cat_1787219100769', 'Gay Tax', 'Gay', 1, 9, 'admin', '2026-08-20 09:46:58', '2026-08-20 09:53:20');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','treasurer','auditor') NOT NULL DEFAULT 'auditor',
  `full_name` varchar(100) DEFAULT 'Unassigned'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `full_name`) VALUES
(1, 'admin', '$2y$10$Hj3eHeJrvmkLKpa84rzss.YbHpDaWzmYq.V5xvNct2M/jj.cZHQ5e', 'admin', 'Admin User'),
(2, 'treasurer', '$2y$10$9ovfZH0UJmC0cv38/ZtQm.ZFNsPp0MP.Jl7txtexfMmuMzyOi3cVy', 'treasurer', 'Treasurer User'),
(3, 'auditor', '$2y$10$KJJPgkTthHt/9yMnckvRt.jgCXFjtUl/kTbBXk3CsHQYTLpd/7W.u', 'auditor', 'Auditor User');

-- --------------------------------------------------------

--
-- Table structure for table `user_logs`
--

CREATE TABLE `user_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `role` varchar(20) NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_logs`
--

INSERT INTO `user_logs` (`id`, `user_id`, `username`, `role`, `action`, `details`, `created_at`) VALUES
(1, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-13 09:23:34'),
(2, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: it-1-section-e', '2026-05-13 09:43:31'),
(3, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-05-13 09:44:52'),
(4, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-05-13 09:49:06'),
(5, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-13 09:55:32'),
(6, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-05-13 10:28:12'),
(7, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-05-13 10:28:30'),
(8, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-13 10:29:28'),
(9, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-14 04:31:22'),
(10, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: it-dept-5th-year', '2026-05-14 04:37:10'),
(11, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: evt-acq-seats', '2026-05-14 04:40:17'),
(12, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: it-1-section-e', '2026-05-14 05:29:32'),
(13, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: it-1-section-e', '2026-05-14 05:29:41'),
(14, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-27 05:36:41'),
(15, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: evt-or-gay', '2026-05-27 05:38:32'),
(16, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2025-2026', '2026-05-27 07:22:49'),
(17, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 3030-3031', '2026-05-27 07:39:37'),
(18, 1, 'admin', 'admin', 'Item Deleted', 'Deleted item record: dept-1779868226624-1-section-a', '2026-05-27 07:51:26'),
(19, 1, 'admin', 'admin', 'Account Update', 'Updated name and username for ADMIN account.', '2026-05-27 08:05:02'),
(20, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-05-27 09:19:14'),
(21, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-15 05:55:20'),
(22, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-15 06:11:29'),
(23, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-08-15 06:19:52'),
(24, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-15 06:40:37'),
(25, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2026-2027', '2026-08-15 06:42:21'),
(26, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2026-2027', '2026-08-15 06:47:27'),
(27, 1, 'admin', 'admin', 'Late Payment', 'Jim lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1786776238925-1-a\', AY 2026-2027.', '2026-08-15 06:48:10'),
(28, 1, 'admin', 'admin', 'Late Payment Reversed', 'Reversed late payment: Jim lloyd Barredo / T-SHIRT (₱500.00) for \'dept-1786776238925-1-a\', AY 2026-2027.', '2026-08-15 06:48:48'),
(29, 1, 'admin', 'admin', 'Late Payment', 'Jim Lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1786776238925-1-a\', AY 2026-2027.', '2026-08-15 06:49:33'),
(30, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2026-2027', '2026-08-15 07:09:36'),
(31, 1, 'admin', 'admin', 'Late Payment', 'Jim Lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1786777673270-1-a\', AY 2026-2027.', '2026-08-15 07:10:05'),
(32, 1, 'admin', 'admin', 'Late Payment Reversed', 'Reversed late payment: Jim Lloyd Barredo / T-SHIRT (₱500.00) for \'dept-1786777673270-1-a\', AY 2026-2027.', '2026-08-15 07:10:16'),
(33, 1, 'admin', 'admin', 'Late Payment', 'JIm Lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1786777673270-1-a\', AY 2026-2027.', '2026-08-15 07:10:44'),
(34, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-20 08:29:23'),
(35, 1, 'admin', 'admin', 'Late Payment Reversed', 'Reversed late payment: JIm Lloyd Barredo / T-SHIRT (₱500.00) for \'dept-1786777673270-1-a\', AY 2026-2027.', '2026-08-20 08:30:23'),
(36, 1, 'admin', 'admin', 'Late Payment', 'Jim Lloyd Barredo settled T-SHIRT (₱500.00) for \'UNPAID-SUMMARY-1786777776\', AY 2026-2027.', '2026-08-20 08:50:28'),
(37, 1, 'admin', 'admin', 'Unpaid Student Flagged', 'Flagged JIM as unpaid for \'dept-1779868226624-1-section-a\', AY 2026-2027.', '2026-08-20 08:51:05'),
(38, 1, 'admin', 'admin', 'Late Payment', 'JIM settled T-SHIRT (₱500.00) for \'dept-1779868226624-1-section-a\', AY 2026-2027.', '2026-08-20 08:51:21'),
(39, 1, 'admin', 'admin', 'Unpaid Student Flag Removed', 'Removed unpaid flag for JIM (\'dept-1779868226624-1-section-a\', AY 2026-2027).', '2026-08-20 09:22:15'),
(40, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2026-2027 (1 unpaid student(s) flagged for follow-up.)', '2026-08-20 09:25:54'),
(41, 1, 'admin', 'admin', 'Late Payment', 'Jim Lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1787217822184-1-a\', AY 2026-2027.', '2026-08-20 09:26:19'),
(42, 1, 'admin', 'admin', 'Unpaid Student Flag Removed', 'Removed unpaid flag for Jim Lloyd Barredo (\'dept-1787217822184-1-a\', AY 2026-2027).', '2026-08-20 09:26:39'),
(43, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2026-2027 (1 unpaid student(s) flagged for follow-up.)', '2026-08-20 09:28:15'),
(44, 1, 'admin', 'admin', 'Late Payment', 'Jim Lloyd Barredo settled T-SHIRT (₱500.00) for \'dept-1787218007569-1-a\', AY 2026-2027.', '2026-08-20 09:28:30'),
(45, 1, 'admin', 'admin', 'Unpaid Student Flag Removed', 'Removed unpaid flag for Jim Lloyd Barredo (\'dept-1787218007569-1-a\', AY 2026-2027).', '2026-08-20 09:30:42'),
(46, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-20 09:37:03'),
(47, 1, 'admin', 'admin', 'System Reboot', 'System rebooted and data archived for Academic Year: 2027-2028 (2 unpaid student(s) flagged for follow-up.)', '2026-08-20 09:46:58'),
(48, 1, 'admin', 'admin', 'Late Payment', 'John Rosswern Agustin Bensurto settled Gay Tax (₱10.00) for \'dept-1787218659674-1-section-a\', AY 2027-2028.', '2026-08-20 09:53:20'),
(49, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-23 09:20:05'),
(50, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-08-23 09:37:17'),
(51, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-23 09:54:18'),
(52, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-08-23 10:27:28'),
(53, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-23 10:28:46'),
(54, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-25 10:56:08'),
(55, 1, 'admin', 'admin', 'Document Uploaded', 'Uploaded document \'Spider-Man (RAIMI)\' — file: 1787656839_Maguire.webp', '2026-08-25 11:20:39'),
(56, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-08-25 11:21:09'),
(57, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 11:48:43'),
(58, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:05:10'),
(59, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:05:29'),
(60, 1, 'admin', 'admin', 'Document Deleted', 'Deleted document \'Spider-Man (RAIMI)\' (originally uploaded by admin)', '2026-09-28 12:06:18'),
(61, 1, 'admin', 'admin', 'Document Deleted', 'Deleted document \'Dante\'', '2026-09-28 12:06:21'),
(62, 1, 'admin', 'admin', 'Document Uploaded', 'Uploaded document \'IT 4-A\' (category: 4th Year Sections) — file: 1790597340_gogeta.jpg', '2026-09-28 12:09:00'),
(63, 1, 'admin', 'admin', 'Document Uploaded', 'Uploaded document \'ASDGASDG\' (category: 4th Year Sections) — file: 1790597624_images.jpg', '2026-09-28 12:13:44'),
(64, 1, 'admin', 'admin', 'Document Deleted', 'Deleted document \'IT 4-A\' (originally uploaded by admin)', '2026-09-28 12:22:57'),
(65, 1, 'admin', 'admin', 'Document Deleted', 'Deleted document \'ASDGASDG\' (originally uploaded by admin)', '2026-09-28 12:22:59'),
(66, 1, 'admin', 'admin', 'Document Uploaded', 'Uploaded document \'GOGETA\' (category: 4th Year Sections) — file: 1790598196_gogeta.jpg', '2026-09-28 12:23:16'),
(67, 1, 'admin', 'admin', 'Document Deleted', 'Deleted document \'GOGETA\' (originally uploaded by admin)', '2026-09-28 12:24:06'),
(68, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:24:17'),
(69, 2, 'treasurer', 'treasurer', 'Document Uploaded', 'Uploaded document \'Gogeta - IT1C\' (category: Section C) — file: 1790598364_gogeta.jpg', '2026-09-28 12:26:04'),
(70, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:27:11'),
(71, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:30:22'),
(72, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:34:51'),
(73, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:38:31'),
(74, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:39:16'),
(75, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-09-28 12:39:37'),
(76, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-05 12:07:29'),
(77, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-05 12:34:23'),
(78, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:13:45'),
(79, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:17:42'),
(80, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:18:04'),
(81, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:18:21'),
(82, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:18:57'),
(83, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:19:47'),
(84, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:20:14'),
(85, 1, 'admin', 'admin', 'Late Payment', 'Gladys Feliciano settled T-SHIRT (₱480.00) for \'dept-1787218659674-1-section-b\', AY 2027-2028.', '2026-10-08 17:33:02'),
(86, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:33:38'),
(87, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:34:38'),
(88, 1, 'admin', 'admin', 'Budget Update', 'Set initial budget for \'exp-1791480833999-sound-system\' to 10,000.00', '2026-10-08 17:36:32'),
(89, 1, 'admin', 'admin', 'Budget Update', 'Set initial budget for \'exp-1791480833999-venue\' to 10,000.00', '2026-10-08 17:36:32'),
(90, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:36:54'),
(91, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:38:04'),
(92, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:39:56'),
(93, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:43:47'),
(94, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:51:48'),
(95, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-08 17:57:50'),
(96, 2, 'treasurer', 'treasurer', 'Document Uploaded', 'Uploaded document \'Sound System Receipt\' (category: Sound System) — file: 1791482779_sana_twice_with_youth_kpop_125_1_o_thumb.jpg', '2026-10-08 18:06:19'),
(97, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-08 18:06:36'),
(98, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-08 18:10:59'),
(99, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-09 05:43:41'),
(100, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-09 05:44:00'),
(101, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-09 05:45:13'),
(102, 2, 'treasurer', 'treasurer', 'Document Uploaded', 'Uploaded document \'Venue Receipt\' (category: Venue) — file: 1791524758_dahyun_twice_with_youth_kpop_120_1_o_thumb.jpg', '2026-10-09 05:45:58'),
(103, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-09 05:46:11'),
(104, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-09 06:26:39'),
(105, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-09 06:27:14'),
(106, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-09 06:30:11'),
(107, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-12 00:27:34'),
(108, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-12 00:28:03'),
(109, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-12 00:29:15'),
(110, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-12 00:29:34'),
(111, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-14 08:19:22'),
(112, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-14 08:21:16'),
(113, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-14 08:22:12'),
(114, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-14 08:27:19'),
(115, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-14 08:27:53'),
(116, 3, 'auditor', 'auditor', 'Password Reset Requested', 'Officer requested admin approval for password recovery.', '2026-10-15 06:11:53'),
(117, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-15 06:12:08'),
(118, 1, 'admin', 'admin', 'Password Reset Approved', 'Approved reset request #1 for auditor (code shown only once).', '2026-10-15 06:12:27'),
(119, 1, 'admin', 'admin', 'Password Reset Code Reissued', 'Reissued reset code for request #1 for auditor (code shown only once).', '2026-10-15 06:12:47'),
(120, 3, 'auditor', 'officer', 'Password Reset Completed', 'Password was reset with an approved one-time code.', '2026-10-15 06:13:46'),
(121, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 06:14:05'),
(122, 1, 'admin', 'admin', 'Account Update', 'Updated credentials and name for AUDITOR account.', '2026-10-15 06:14:40'),
(123, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 06:15:04'),
(124, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 06:28:54'),
(125, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 06:29:44'),
(126, 2, 'treasurer', 'treasurer', 'Collection Recorded', 'COL-1 | Department of Information Technology / 1st Year Sections / Section B | INTRAMS | PHP 50.00 | Received 2026-10-15', '2026-10-15 07:42:39'),
(127, 2, 'treasurer', 'treasurer', 'Cash Advance Created', 'Created cash advance account #1', '2026-10-15 07:46:57'),
(128, 2, 'treasurer', 'treasurer', 'Cash Advance Movement', 'advance CA-1, PHP 1000.00, 2026-10-15', '2026-10-15 07:47:19'),
(129, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 07:47:58'),
(130, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 07:57:02'),
(131, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 08:25:27'),
(132, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-15 08:25:48'),
(133, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 09:24:29'),
(134, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-1 | classroom | dept-1787221083362-1-section-a | 2026-10-15 | 13150.00', '2026-10-15 09:40:40'),
(135, 2, 'treasurer', 'treasurer', 'Financial Inputs Cleared', 'Cleared active collection totals; earlier section remittances retained as cleared history.', '2026-10-15 09:49:28'),
(136, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-2 | classroom | dept-1787221083362-1-section-a | 2026-10-15 | 13250.00', '2026-10-15 09:51:52'),
(137, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 10:25:47'),
(138, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 10:27:37'),
(139, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 10:28:58'),
(140, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 10:34:01'),
(141, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 10:36:46'),
(142, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-3 | classroom | dept-1787221083362-1-section-b | 2026-10-15 | 14400.00', '2026-10-15 10:57:35'),
(143, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-15 11:07:08'),
(144, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-15 11:09:11'),
(145, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-15 11:57:13'),
(146, 3, 'auditor', 'auditor', 'Audit Sheet Created', 'Sheet #1 | Aquintance | 1', '2026-10-15 11:58:33'),
(147, 3, 'auditor', 'auditor', 'Audit Receipt Entry', 'Entry #1 | sheet #1 | advance | 2026-10-15 | 233232.00', '2026-10-15 12:23:15'),
(148, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #1 | Prior record: {\"id\":1,\"request_id\":\"c0583b2c-55a6-4031-af6f-3e94e045a748\",\"sheet_id\":1,\"entry_date\":\"2026-10-15\",\"entry_type\":\"advance\",\"voucher_no\":\"2313124\",\"or_number\":\"1123214\",\"payee\":\"GAISANO\",\"nature\":\"Assorted Bread\",\"amount\":\"233232.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 20:23:15\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-15 12:23:49'),
(149, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #1 | Prior record: {\"id\":1,\"request_id\":\"c0583b2c-55a6-4031-af6f-3e94e045a748\",\"sheet_id\":1,\"entry_date\":\"2026-10-15\",\"entry_type\":\"advance\",\"voucher_no\":\"2313124\",\"or_number\":\"1123214\",\"payee\":\"GAISANO\",\"nature\":\"Assorted Bread\",\"amount\":\"12000.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 20:23:15\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-15 12:24:30'),
(150, 3, 'auditor', 'auditor', 'Audit Receipt Entry', 'Entry #2 | sheet #1 | disbursement | 2026-10-15 | 2000.00', '2026-10-15 12:25:26'),
(151, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #2 | Prior record: {\"id\":2,\"request_id\":\"ee164cd7-59fb-41e4-836d-5b1104a966b4\",\"sheet_id\":1,\"entry_date\":\"2026-10-15\",\"entry_type\":\"disbursement\",\"voucher_no\":\"123124\",\"or_number\":\"12312124\",\"payee\":\"GAISANO\",\"nature\":\"ASSORTED BREAD\",\"amount\":\"2000.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 20:25:26\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-15 12:26:26'),
(152, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #1 | Prior record: {\"id\":1,\"request_id\":\"c0583b2c-55a6-4031-af6f-3e94e045a748\",\"sheet_id\":1,\"entry_date\":\"2026-10-15\",\"entry_type\":\"advance\",\"voucher_no\":\"2313124\",\"or_number\":\"1123214\",\"payee\":\"GAISANO\",\"nature\":\"Cash advance for the Acquintance\",\"amount\":\"12000.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 20:23:15\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-15 12:26:27'),
(153, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #2 | Prior record: {\"id\":2,\"request_id\":\"ee164cd7-59fb-41e4-836d-5b1104a966b4\",\"sheet_id\":1,\"entry_date\":\"2026-10-15\",\"entry_type\":\"disbursement\",\"voucher_no\":\"123124\",\"or_number\":\"12312124\",\"payee\":\"GAISANO\",\"nature\":\"ASSORTED BREAD\",\"amount\":\"2000.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 20:25:26\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-15 12:28:29'),
(154, 3, 'auditor', 'auditor', 'Audit Entry Voided', 'Entry #1 | redundant', '2026-10-15 12:47:22'),
(155, 3, 'auditor', 'auditor', 'Audit Entry Voided', 'Entry #2 | redundant', '2026-10-15 12:47:26'),
(156, 3, 'auditor', 'auditor', 'Audit Receipt Entry', 'Entry #3 | sheet #2 | advance | 2026-09-11 | 91720.00', '2026-10-15 12:51:47'),
(157, 3, 'auditor', 'auditor', 'Audit Receipt Entry', 'Entry #4 | sheet #2 | disbursement | 2026-08-31 | 1100.00', '2026-10-15 12:51:47'),
(158, 3, 'auditor', 'auditor', 'Audit Receipt Entry', 'Entry #5 | sheet #2 | disbursement | 2026-09-01 | 100.00', '2026-10-15 13:08:40'),
(159, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:01:36'),
(160, 3, 'auditor', 'auditor', 'Password Reset Requested', 'Officer requested admin approval for password recovery.', '2026-10-18 17:01:54'),
(161, 1, 'admin', 'admin', 'Password Reset Approved', 'Approved reset request #2 for auditor (code shown only once).', '2026-10-18 17:02:10'),
(162, 3, 'auditor', 'officer', 'Password Reset Completed', 'Password was reset with an approved one-time code.', '2026-10-18 17:03:05'),
(163, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:03:20'),
(164, 1, 'admin', 'admin', 'Account Update', 'Updated credentials and name for AUDITOR account.', '2026-10-18 17:03:45'),
(165, 1, 'admin', 'admin', 'Account Update', 'Updated credentials and name for AUDITOR account.', '2026-10-18 17:03:58'),
(166, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:04:32'),
(167, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:05:25'),
(168, 1, 'admin', 'admin', 'Account Update', 'Updated credentials and name for AUDITOR account.', '2026-10-18 17:05:36'),
(169, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:05:43'),
(170, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #5 | Prior record: {\"id\":5,\"request_id\":\"92fccb2a-54a0-40ac-9d57-6cd2f30e6620\",\"sheet_id\":2,\"entry_date\":\"2026-09-01\",\"entry_type\":\"disbursement\",\"voucher_no\":\"\",\"or_number\":\"\",\"payee\":\"ACEDRE STORE\",\"nature\":\"COOKING OIL\",\"amount\":\"100.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 21:08:40\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-18 17:08:31'),
(171, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 0 names | cycle 47', '2026-10-18 17:34:08'),
(172, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 0 names | cycle 47', '2026-10-18 17:34:25'),
(173, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-18 17:35:08'),
(174, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-18 17:36:18'),
(175, 3, 'auditor', 'auditor', 'Document Deleted', 'Document #9 | Gogeta - IT1C | uploaded by treasurer | detached audit rows: []', '2026-10-18 18:20:29'),
(176, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-18 19:08:25'),
(177, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-18 19:10:28'),
(178, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-18 19:27:44'),
(179, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-19 07:57:10'),
(180, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-19 07:57:54'),
(181, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-19 07:58:45'),
(182, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-19 08:27:13'),
(183, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-19 08:27:49'),
(184, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-19 08:29:08'),
(185, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-20 01:40:36'),
(186, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 01:41:10'),
(187, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 01:41:30'),
(188, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-4 | classroom | dept-1787221083362-1-section-a | 2026-10-20 | 500.00', '2026-10-20 01:42:20'),
(189, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-20 01:49:03'),
(190, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 1 names | cycle 47', '2026-10-20 01:51:19'),
(191, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-5 | classroom | dept-1787221083362-1-section-a | 2026-10-20 | 300.00', '2026-10-20 01:51:38'),
(192, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 1 names | cycle 47', '2026-10-20 01:52:43'),
(193, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 1 names | cycle 47', '2026-10-20 02:03:03'),
(194, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 1 names | cycle 47', '2026-10-20 02:03:07'),
(195, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-6 | classroom | dept-1787221083362-1-section-a | 2026-10-20 | 300.00', '2026-10-20 02:03:13'),
(196, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 2 names | cycle 47', '2026-10-20 02:03:58'),
(197, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 02:04:18'),
(198, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-20 03:04:46'),
(199, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-20 03:04:56'),
(200, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-20 03:05:07'),
(201, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 03:26:11'),
(202, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 03:26:13'),
(203, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-20 03:27:13'),
(204, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-7 | classroom | dept-1787221083362-1-section-b | 2026-10-20 | 2400.00', '2026-10-20 03:53:35'),
(205, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-20 03:58:46'),
(206, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-21 10:22:19'),
(207, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-21 10:22:29'),
(208, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-21 10:22:44'),
(209, 1, 'admin', 'admin', 'Layout Updated', 'Admin updated programs/events/items. Removed item keys: ', '2026-10-21 11:08:19'),
(210, 1, 'admin', 'admin', 'Layout Updated', 'Admin updated programs/events/items. Removed item keys: ', '2026-10-21 11:08:35'),
(211, 1, 'admin', 'admin', 'Budget Update', 'Set initial budget for \'exp-d96726b6-46ee-4c59-966b-696f51a50bfd-sound-system\' to 10,000.00', '2026-10-21 11:14:08'),
(212, 3, 'auditor', 'auditor', 'Audit Entry Updated', 'Entry #5 | Prior record: {\"id\":5,\"request_id\":\"92fccb2a-54a0-40ac-9d57-6cd2f30e6620\",\"sheet_id\":2,\"entry_date\":\"2026-09-01\",\"entry_type\":\"disbursement\",\"voucher_no\":\"\",\"or_number\":\"\",\"payee\":\"ACEDRE STORE\",\"nature\":\"COOKING OIL\",\"amount\":\"100.00\",\"document_id\":null,\"audit_status\":\"pending\",\"audit_note\":\"\",\"created_by_id\":3,\"created_by\":\"auditor\",\"recorded_at\":\"2026-10-15 21:08:40\",\"voided_at\":null,\"voided_by\":null,\"void_reason\":null}', '2026-10-21 11:24:45'),
(213, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-8 | classroom | dept-1787221083362-1-section-a | 2026-10-21 | 500.00', '2026-10-21 11:50:44'),
(214, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 1 names | cycle 47', '2026-10-21 12:58:11'),
(215, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 2 names | cycle 47', '2026-10-21 13:10:09'),
(216, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 2 names | cycle 47', '2026-10-21 13:12:26'),
(217, 1, 'admin', 'admin', 'Report Signatories Updated', 'Default names and positions updated.', '2026-10-21 13:57:22'),
(218, 1, 'admin', 'admin', 'Report Signatories Updated', 'Default names and positions updated.', '2026-10-21 13:57:24'),
(219, 1, 'admin', 'admin', 'Report Signatories Updated', 'Default names and positions updated.', '2026-10-21 13:57:27'),
(220, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-21 14:15:43'),
(221, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-22 02:16:52'),
(222, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-22 02:18:48'),
(223, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 02:28:04'),
(224, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 02:28:08'),
(225, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-22 03:30:55'),
(226, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-22 03:31:26'),
(227, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-22 04:18:38'),
(228, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-22 04:19:01'),
(229, 1, 'admin', 'admin', 'Layout Updated', 'Admin updated programs/events/items. Removed item keys: ', '2026-10-22 04:59:11'),
(230, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-22 10:29:56'),
(231, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-22 10:34:28'),
(232, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-22 10:39:02'),
(233, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 10:43:29'),
(234, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 10:44:27'),
(235, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 10:44:35'),
(236, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-9 | classroom | dept-1787221083362-1-section-a | 2026-10-22 | 810.00', '2026-10-22 10:45:41'),
(237, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-22 11:06:16'),
(238, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-22 11:11:30'),
(239, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 2 names | cycle 47', '2026-10-22 13:30:07'),
(240, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 2 names | cycle 47', '2026-10-22 13:30:29'),
(241, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 2 names | cycle 47', '2026-10-22 13:30:44'),
(242, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-c | T-SHIRT | 2 names | cycle 47', '2026-10-22 13:59:13'),
(243, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-c | T-SHIRT | 3 names | cycle 47', '2026-10-22 13:59:55'),
(244, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-c | T-SHIRT | 3 names | cycle 47', '2026-10-22 13:59:59'),
(245, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-c | T-SHIRT | 3 names | cycle 47', '2026-10-22 14:00:03'),
(246, 1, 'admin', 'admin', 'Layout Updated', 'Admin updated programs/events/items. Removed item keys: ', '2026-10-22 14:02:40'),
(247, 1, 'admin', 'admin', 'Layout Updated', 'Admin updated programs/events/items. Removed item keys: ', '2026-10-22 14:02:53'),
(248, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-c | T-SHIRT | 3 names | cycle 47', '2026-10-22 14:04:27'),
(249, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-a | T-SHIRT | 2 names | cycle 47', '2026-10-22 14:06:04'),
(250, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-a | T-SHIRT | 3 names | cycle 47', '2026-10-22 14:06:23'),
(251, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-a | T-SHIRT | 3 names | cycle 47', '2026-10-22 14:06:34'),
(252, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-a | INTRAMS | 1 names | cycle 47', '2026-10-22 14:07:22'),
(253, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-a | FOODS | 1 names | cycle 47', '2026-10-22 14:08:07'),
(254, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-b | T-SHIRT | 2 names | cycle 47', '2026-10-22 14:08:50'),
(255, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-b | INTRAMS | 2 names | cycle 47', '2026-10-22 14:09:47'),
(256, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-c | T-SHIRT | 2 names | cycle 47', '2026-10-22 14:10:26'),
(257, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-c | INTRAMS | 1 names | cycle 47', '2026-10-22 14:10:48'),
(258, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-2-section-c | FOODS | 2 names | cycle 47', '2026-10-22 14:11:26'),
(259, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-23 11:41:07'),
(260, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-23 11:41:28'),
(261, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-23 11:46:40'),
(262, 1, 'admin', 'admin', 'Financial Inputs Cleared', 'Cleared active collection totals; Admin test reset also removed active student payment lists and current-cycle section remittances. {\"sections\":17,\"student_entries\":23,\"remittances\":8}', '2026-10-23 12:57:08'),
(263, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47 | Collection adjustment: 200.00', '2026-10-23 12:59:00'),
(264, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | T-SHIRT | 2 names | cycle 47 | Collection adjustment: 0.00', '2026-10-23 13:19:28'),
(265, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | INTRAMS | 2 names | cycle 47 | Collection adjustment: 150.00', '2026-10-23 13:20:29'),
(266, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-10 | classroom | dept-1787221083362-1-section-a | 2026-10-23 | 350.00', '2026-10-23 13:21:30'),
(267, 2, 'treasurer', 'treasurer', 'Unpaid Category List Updated', 'dept-1787221083362-1-section-a | FOODS | 1 names | cycle 47 | Collection adjustment: 30.00', '2026-10-23 13:24:39'),
(268, 2, 'treasurer', 'treasurer', 'Section Remittance', 'SR-11 | classroom | dept-1787221083362-1-section-a | 2026-10-23 | 30.00', '2026-10-23 13:24:48'),
(269, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-23 15:15:30'),
(270, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-26 09:27:26'),
(271, 1, 'admin', 'admin', 'System Login', 'User authenticated and logged in.', '2026-10-26 09:53:41'),
(272, 3, 'auditor', 'auditor', 'System Login', 'User authenticated and logged in.', '2026-10-26 10:14:17'),
(273, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-26 10:15:12');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `auditor_receipt_entries`
--
ALTER TABLE `auditor_receipt_entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD KEY `sheet_date` (`sheet_id`,`entry_date`,`id`),
  ADD KEY `receipt_document` (`document_id`);

--
-- Indexes for table `auditor_receipt_sheets`
--
ALTER TABLE `auditor_receipt_sheets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `event_sheet` (`event_title`,`sheet_no`);

--
-- Indexes for table `budgets`
--
ALTER TABLE `budgets`
  ADD PRIMARY KEY (`item_key`);

--
-- Indexes for table `collections`
--
ALTER TABLE `collections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `item_key` (`item_key`);

--
-- Indexes for table `conversations`
--
ALTER TABLE `conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_updated_at` (`updated_at`),
  ADD KEY `fk_conversations_created_by` (`created_by`);

--
-- Indexes for table `conversation_participants`
--
ALTER TABLE `conversation_participants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_conversation_user` (`conversation_id`,`user_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_last_read_message_id` (`last_read_message_id`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `expenditures`
--
ALTER TABLE `expenditures`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `item_key` (`item_key`),
  ADD KEY `idx_item_key` (`item_key`);

--
-- Indexes for table `late_payments`
--
ALTER TABLE `late_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_year_item` (`academic_year`,`item_key`),
  ADD KEY `idx_student_name` (`student_name`),
  ADD KEY `idx_item_key` (`item_key`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conversation_created` (`conversation_id`,`created_at`),
  ADD KEY `idx_sender_id` (`sender_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_unread` (`user_id`,`is_read`,`created_at`),
  ADD KEY `fk_notifications_conversation` (`conversation_id`);

--
-- Indexes for table `password_reset_rate_limits`
--
ALTER TABLE `password_reset_rate_limits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reset_limit` (`ip_hash`,`attempted_at`);

--
-- Indexes for table `password_reset_requests`
--
ALTER TABLE `password_reset_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reset_user_status` (`user_id`,`status`,`requested_at`),
  ADD KEY `idx_reset_status_time` (`status`,`requested_at`),
  ADD KEY `fk_reset_admin` (`approved_by`);

--
-- Indexes for table `recovered_school_years`
--
ALTER TABLE `recovered_school_years`
  ADD PRIMARY KEY (`school_year`);

--
-- Indexes for table `recovered_year_activity`
--
ALTER TABLE `recovered_year_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recovered_activity_year` (`school_year`,`id`);

--
-- Indexes for table `school_year_snapshots`
--
ALTER TABLE `school_year_snapshots`
  ADD PRIMARY KEY (`school_year`);

--
-- Indexes for table `section_remittances`
--
ALTER TABLE `section_remittances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD KEY `section_cycle` (`item_key`,`cycle_id`),
  ADD KEY `remitted_date` (`date_remitted`);

--
-- Indexes for table `section_settings`
--
ALTER TABLE `section_settings`
  ADD PRIMARY KEY (`section_key`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `unpaid_students`
--
ALTER TABLE `unpaid_students`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_year_item` (`academic_year`,`item_key`),
  ADD KEY `idx_student_name` (`student_name`),
  ADD KEY `idx_settled_payment_id` (`settled_payment_id`),
  ADD KEY `idx_item_key` (`item_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `user_logs`
--
ALTER TABLE `user_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `auditor_receipt_entries`
--
ALTER TABLE `auditor_receipt_entries`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `auditor_receipt_sheets`
--
ALTER TABLE `auditor_receipt_sheets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `collections`
--
ALTER TABLE `collections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24773;

--
-- AUTO_INCREMENT for table `conversations`
--
ALTER TABLE `conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `conversation_participants`
--
ALTER TABLE `conversation_participants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `expenditures`
--
ALTER TABLE `expenditures`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9057;

--
-- AUTO_INCREMENT for table `late_payments`
--
ALTER TABLE `late_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `password_reset_rate_limits`
--
ALTER TABLE `password_reset_rate_limits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `password_reset_requests`
--
ALTER TABLE `password_reset_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `recovered_year_activity`
--
ALTER TABLE `recovered_year_activity`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `section_remittances`
--
ALTER TABLE `section_remittances`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `unpaid_students`
--
ALTER TABLE `unpaid_students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `user_logs`
--
ALTER TABLE `user_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=274;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `auditor_receipt_entries`
--
ALTER TABLE `auditor_receipt_entries`
  ADD CONSTRAINT `fk_audit_receipt_sheet` FOREIGN KEY (`sheet_id`) REFERENCES `auditor_receipt_sheets` (`id`);

--
-- Constraints for table `conversations`
--
ALTER TABLE `conversations`
  ADD CONSTRAINT `fk_conversations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `conversation_participants`
--
ALTER TABLE `conversation_participants`
  ADD CONSTRAINT `fk_participants_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_participants_last_read` FOREIGN KEY (`last_read_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_participants_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `password_reset_requests`
--
ALTER TABLE `password_reset_requests`
  ADD CONSTRAINT `fk_reset_admin` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `unpaid_students`
--
ALTER TABLE `unpaid_students`
  ADD CONSTRAINT `fk_unpaid_students_late_payment` FOREIGN KEY (`settled_payment_id`) REFERENCES `late_payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `user_logs`
--
ALTER TABLE `user_logs`
  ADD CONSTRAINT `fk_user_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
