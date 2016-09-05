-- phpMyAdmin SQL Dump
-- version 4.0.10.16
-- http://www.phpmyadmin.net
--
-- 主机: localhost
-- 生成日期: 2016-09-05 03:25:42
-- 服务器版本: 5.6.32
-- PHP 版本: 5.4.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- 数据库: `ngrok`
--

-- --------------------------------------------------------

--
-- 表的结构 `member`
--

CREATE TABLE IF NOT EXISTS `member` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) DEFAULT NULL,
  `password` varchar(50) DEFAULT NULL,
  `traffic_megabytes` int(11) NOT NULL DEFAULT '0',
  `traffic_byte` int(11) NOT NULL DEFAULT '0',
  `http_traffic_megabytes` int(11) NOT NULL DEFAULT '0',
  `http_traffic_byte` int(11) NOT NULL DEFAULT '0',
  `tcp_traffic_byte` int(11) NOT NULL DEFAULT '0',
  `tcp_traffic_megabytes` int(11) NOT NULL DEFAULT '0',
  `enable` tinyint(1) NOT NULL DEFAULT '0',
  `max_http_traffic` int(11) NOT NULL DEFAULT '0',
  `max_traffic` int(11) NOT NULL DEFAULT '0' COMMENT '最大流量',
  `max_tcp_traffic` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=3 ;

--
-- 转存表中的数据 `member`
--

INSERT INTO `member` (`id`, `username`, `password`, `traffic_megabytes`, `traffic_byte`, `http_traffic_megabytes`, `http_traffic_byte`, `tcp_traffic_byte`, `tcp_traffic_megabytes`, `enable`, `max_http_traffic`, `max_traffic`, `max_tcp_traffic`) VALUES
(1, 'wj008', '5583701', 1, 187779, 1, 385773, 850582, 0, 1, 0, 50000, 0),
(2, 'xj0001', '123456', 0, 134860, 0, 116412, 18448, 0, 0, 0, 50000, 0);

-- --------------------------------------------------------

--
-- 表的结构 `setting`
--

CREATE TABLE IF NOT EXISTS `setting` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `mode` varchar(10) DEFAULT NULL,
  `port` int(11) DEFAULT '0',
  `domain` varchar(255) DEFAULT NULL,
  `userid` int(11) DEFAULT NULL,
  `localhost` varchar(50) DEFAULT NULL,
  `localport` int(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=11 ;

--
-- 转存表中的数据 `setting`
--

INSERT INTO `setting` (`id`, `mode`, `port`, `domain`, `userid`, `localhost`, `localport`) VALUES
(1, 'tcp', 10022, '', 1, '127.0.0.1', 22),
(2, 'http', 0, 'abc.test.com', 1, '127.0.0.1', 8080),
(3, 'tcp', 19999, '', 1, '127.0.0.1', 9999),
(4, 'tcp', 13690, '', 1, '127.0.0.1', 3690),
(5, 'tcp', 19666, '', 1, '127.0.0.1', 9666),
(6, 'tcp', 13306, '', 1, '127.0.0.1', 3306),
(7, 'tcp', 16379, '', 1, '127.0.0.1', 6379),
(9, 'http', 0, 'box.test.com', 2, '127.0.0.1', 8080);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
