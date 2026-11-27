package com.tracker75.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

object AttendoCore {
    init {
        System.loadLibrary("attendo_core")
    }

    private external fun nativeInit(dbPath: String): String
    private external fun nativeInvoke(method: String, payload: String): String

    fun init(dbPath: String): Boolean {
        return try {
            val res = JSONObject(nativeInit(dbPath))
            res.optBoolean("ok", false)
        } catch (e: Exception) {
            false
        }
    }

    suspend fun invoke(method: String, params: JSONObject = JSONObject()): Result<JSONObject> =
        withContext(Dispatchers.IO) {
            try {
                val raw = nativeInvoke(method, params.toString())
                val root = JSONObject(raw)
                if (root.optBoolean("ok", false)) {
                    val data = root.optJSONObject("data") ?: JSONObject().apply {
                        put("_raw", root.opt("data"))
                    }
                    Result.success(data)
                } else {
                    Result.failure(Exception(root.optString("error", "Unknown Rust engine error")))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun invokeArray(method: String, params: JSONObject = JSONObject()): Result<JSONArray> =
        withContext(Dispatchers.IO) {
            try {
                val raw = nativeInvoke(method, params.toString())
                val root = JSONObject(raw)
                if (root.optBoolean("ok", false)) {
                    Result.success(root.optJSONArray("data") ?: JSONArray())
                } else {
                    Result.failure(Exception(root.optString("error", "Unknown Rust engine error")))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
