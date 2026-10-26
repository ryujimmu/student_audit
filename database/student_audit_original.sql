-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 05, 2026 at 02:39 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

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
-- Table structure for table `budgets`
--

CREATE TABLE `budgets` (
  `item_key` varchar(100) NOT NULL,
  `allocated_amount` decimal(15,2) DEFAULT 0.00,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0,
  `academic_year` varchar(20) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(8770, 'dept-1787218659674-1-section-b', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:46:58', 'Department of Information Technology 1-B'),
(8803, 'dept-1787218659674-1-section-c', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:46:58', 'Department of Information Technology 1-C'),
(8834, 'dept-1787218659674-1-section-d', '{\"cat_1778665291061\":18800,\"cat_1787219100769\":790}', 0.00, 0.00, 0.00, 0.00, '1 unpaid T-SHIRT', 1, '2027-2028', 40, '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1787219100769\",\"name\":\"Gay Tax\",\"price\":10}]', '2026-08-20 09:46:58', 'Department of Information Technology 1-D'),
(9747, 'dept-1787221083362-1-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 1-A'),
(9749, 'dept-1787221083362-2-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 2-A'),
(9752, 'dept-1787221083362-3-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 3-A'),
(9756, 'dept-1787221083362-4-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 4-A'),
(9765, 'dept-1787221099091-1-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Computer Science 1-A'),
(9771, 'dept-1787221099091-2-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Computer Science 2-A'),
(9778, 'dept-1787221099091-3-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Computer Science 3-A'),
(9786, 'dept-1787221099091-4-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Computer Science 4-A'),
(9795, 'dept-1787221127005-1-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Library of Information Science 1-A'),
(9805, 'dept-1787221127005-2-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Library of Information Science 2-A'),
(9816, 'dept-1787221127005-3-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Library of Information Science 3-A'),
(9828, 'dept-1787221127005-4-section-a', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Library of Information Science 4-A'),
(9842, 'dept-1787221083362-1-section-b', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 1-B'),
(9882, 'dept-1787221083362-1-section-c', '{\"cat_1778665291061\":0,\"cat_1790598452525\":0}', 0.00, 0.00, 0.00, 0.00, '', 0, NULL, NULL, NULL, '2026-09-28 12:28:57', 'Department of Information Technology 1-C');

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
(9, 'Gogeta - IT1C', 'Section C', 'uploads/1790598364_gogeta.jpg', '2026-09-28 12:26:04', 2, 'treasurer', 'treasurer');

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
(7523, 'exp-1786776255064-foods', 0.00, '', 1, '2026-2027', '2026-08-15 06:47:27', NULL);

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
(9, '2027-2028', 'dept-1787218659674-1-section-a', 'John Rosswern Agustin Bensurto', 'cat_1787219100769', 'Gay Tax', 10.00, 'pd', 'admin', '2026-08-20 09:53:20');

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
(2, 3, 'message', 'New message from admin', 'oY', 1, 0, '2026-08-23 09:36:01'),
(3, 2, 'message', 'New message from admin', 'wheres the report', 2, 1, '2026-08-23 09:36:10'),
(4, 3, 'message', 'New message from admin', 'oy', 3, 0, '2026-08-23 09:37:00'),
(5, 1, 'message', 'New message from treasurer', 'ill send it to you later', 2, 1, '2026-08-23 09:37:45'),
(6, 1, 'message', 'New message from treasurer', 'i mean drop by', 2, 1, '2026-08-23 09:37:56');

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
('collection_categories', '[{\"id\":\"cat_1778665291061\",\"name\":\"T-SHIRT\",\"price\":480},{\"id\":\"cat_1790598452525\",\"name\":\"INTRAMS\",\"price\":50}]'),
('ui_layout', '{\"collections\":[{\"type\":\"toggle\",\"name\":\"Department of Information Technology\",\"id\":\"dept-1787221083362\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221083362-1\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section B\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"in\",\"name\":\"Section C\",\"parent\":\"dept-1787221083362-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221083362-2\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221083362-3\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221083362-4\",\"parent\":\"dept-1787221083362\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221083362-4\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"Department of Computer Science\",\"id\":\"dept-1787221099091\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221099091-1\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221099091-2\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221099091-3\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221099091-4\",\"parent\":\"dept-1787221099091\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221099091-4\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"Department of Library of Information Science\",\"id\":\"dept-1787221127005\",\"depth\":0},{\"type\":\"toggle\",\"name\":\"1st Year Sections\",\"id\":\"dept-1787221127005-1\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-1\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"2nd Year Sections\",\"id\":\"dept-1787221127005-2\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-2\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"3rd Year Sections\",\"id\":\"dept-1787221127005-3\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-3\",\"depth\":2},{\"type\":\"toggle\",\"name\":\"4th Year Sections\",\"id\":\"dept-1787221127005-4\",\"parent\":\"dept-1787221127005\",\"depth\":1},{\"type\":\"in\",\"name\":\"Section A\",\"parent\":\"dept-1787221127005-4\",\"depth\":2}],\"expenditures\":[]}');

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
(4, '2027-2028', 'dept-1787218659674-1-section-b', 'Gladys Feliciano', 'cat_1778665291061', 'T-SHIRT', NULL, 0, NULL, 'admin', '2026-08-20 09:46:58', NULL),
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
(3, 'auditor', '$2y$10$//knAtXAoLrGbCnaiOvUp.c3Hd9/Lkvobwnj6DNvm3uGFp8R4QBd6', 'auditor', 'Auditor User');

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
(77, 2, 'treasurer', 'treasurer', 'System Login', 'User authenticated and logged in.', '2026-10-05 12:34:23');

--
-- Indexes for dumped tables
--

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
-- AUTO_INCREMENT for table `collections`
--
ALTER TABLE `collections`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10636;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `expenditures`
--
ALTER TABLE `expenditures`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7536;

--
-- AUTO_INCREMENT for table `late_payments`
--
ALTER TABLE `late_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=78;

--
-- Constraints for dumped tables
--

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
