package org.omobeeza.donors

import org.junit.Assert.assertEquals
import org.junit.Test
import org.omobeeza.donors.data.ordinal
import org.omobeeza.donors.data.schedule

class FormatTest {
    @Test fun ordinals() {
        assertEquals(listOf("1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "28th"),
            listOf(1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28).map(::ordinal))
    }

    @Test fun schedules() {
        assertEquals("every Monday", schedule("weekly", 1, 1))
        assertEquals("monthly · 5th", schedule("monthly", 1, 5))
        assertEquals("በየሰኞ", schedule("weekly", 1, 1, "am"))
        assertEquals("በየወሩ 5ኛ ቀን", schedule("monthly", 1, 5, "am"))
    }
}
