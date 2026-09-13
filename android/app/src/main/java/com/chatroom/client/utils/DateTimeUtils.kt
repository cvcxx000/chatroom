package com.chatroom.client.utils

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 统一的时间解析与格式化工具。
 *
 * 服务端 PostgreSQL TIMESTAMPTZ 返回的 ISO 8601 字符串可能带毫秒和时区，例如：
 *  - 2026-09-13T10:30:00.123Z
 *  - 2026-09-13T10:30:00Z
 *  - 2026-09-13T18:30:00.123+08:00
 *  - 2026-09-13T18:30:00+08:00
 *  - 2026-09-13T10:30:00 （无时区兜底）
 */
object DateTimeUtils {

    /**
     * 依次尝试多种 ISO 8601 格式解析时间字符串，解析成功返回 Date，否则返回 null。
     */
    fun parseIsoDateTime(iso: String?): Date? {
        if (iso.isNullOrBlank()) return null
        val candidates = listOf(
            // 带毫秒的 UTC（Z 结尾）
            Pair("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", true),
            // UTC 无毫秒
            Pair("yyyy-MM-dd'T'HH:mm:ss'Z'", true),
            // 带时区偏移 + 毫秒
            Pair("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", false),
            // 带时区偏移无毫秒
            Pair("yyyy-MM-dd'T'HH:mm:ssXXX", false),
            // 无时区，兜底
            Pair("yyyy-MM-dd'T'HH:mm:ss", false)
        )
        for ((pattern, utc) in candidates) {
            runCatching {
                val sdf = SimpleDateFormat(pattern, Locale.US)
                if (utc) sdf.timeZone = TimeZone.getTimeZone("UTC")
                sdf.parse(iso)?.let { return it }
            }
        }
        return null
    }

    /**
     * 聊天界面时间：今天显示 HH:mm，昨天显示 "昨天 HH:mm"，更早显示 "MM-dd HH:mm"。
     */
    fun formatMessageTime(iso: String?): String {
        val date = parseIsoDateTime(iso) ?: return ""
        val now = Calendar.getInstance()
        val cal = Calendar.getInstance().apply { time = date }

        val isToday = sameDay(now, cal)
        val yesterday = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
        val isYesterday = sameDay(yesterday, cal)

        return when {
            isToday -> SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
            isYesterday -> "昨天 " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
            else -> SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(date)
        }
    }

    /**
     * 会话列表时间：今天显示 HH:mm，昨天显示 "昨天"，本周显示 "周X"，更早显示 "MM-dd"。
     */
    fun formatConversationTime(iso: String?): String {
        val date = parseIsoDateTime(iso) ?: return ""
        val now = Calendar.getInstance()
        val cal = Calendar.getInstance().apply { time = date }

        val isToday = sameDay(now, cal)
        val yesterday = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
        val isYesterday = sameDay(yesterday, cal)
        val startOfWeek = startOfWeek(now)
        val isThisWeek = !isToday && !isYesterday && cal.timeInMillis >= startOfWeek.timeInMillis

        return when {
            isToday -> SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
            isYesterday -> "昨天"
            isThisWeek -> weekDayName(cal.get(Calendar.DAY_OF_WEEK))
            else -> SimpleDateFormat("MM-dd", Locale.getDefault()).format(date)
        }
    }

    private fun sameDay(a: Calendar, b: Calendar): Boolean =
        a.get(Calendar.YEAR) == b.get(Calendar.YEAR) &&
            a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)

    /** 本周一 00:00:00 */
    private fun startOfWeek(now: Calendar): Calendar {
        val c = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        // Calendar.SUNDAY=1 ... SATURDAY=7；将周一作为一周开始
        val diff = when (c.get(Calendar.DAY_OF_WEEK)) {
            Calendar.SUNDAY -> 6
            else -> c.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY
        }
        c.add(Calendar.DAY_OF_YEAR, -diff)
        return c
    }

    private fun weekDayName(dayOfWeek: Int): String = when (dayOfWeek) {
        Calendar.MONDAY -> "周一"
        Calendar.TUESDAY -> "周二"
        Calendar.WEDNESDAY -> "周三"
        Calendar.THURSDAY -> "周四"
        Calendar.FRIDAY -> "周五"
        Calendar.SATURDAY -> "周六"
        Calendar.SUNDAY -> "周日"
        else -> ""
    }
}
