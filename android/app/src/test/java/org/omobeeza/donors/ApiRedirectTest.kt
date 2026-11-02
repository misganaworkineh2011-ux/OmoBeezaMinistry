package org.omobeeza.donors

import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.omobeeza.donors.data.Api
import org.omobeeza.donors.data.ApiException

/** Live check (needs internet): sign-in follows omobeezaministry.com → www. */
class ApiRedirectTest {
    @Test fun followsRedirectToWww() = runBlocking {
        assumeTrue(System.getenv("LIVE_TEST") == "1")
        val code = try {
            Api("https://omobeezaministry.com", null).login("x@example.com", "wrong-password-1")
            "ok"
        } catch (e: ApiException) {
            "${e.code} (HTTP ${e.status})"
        }
        println("LIVE RESULT: $code")
    }
}
