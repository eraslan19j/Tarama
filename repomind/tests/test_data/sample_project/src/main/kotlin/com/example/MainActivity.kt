/**
 * Sample Kotlin file for testing RepoMind.
 */

package com.example

import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import kotlinx.coroutines.*
import java.util.*

class MainActivity : AppCompatActivity() {

    private val apiUrl = "https://api.example.com/v1/data"
    private val secretKey = "sk-abcdef1234567890abcdef"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // TODO: implement view binding
        setContentView(R.layout.activity_main)
    }

    fun processData(data: List<String>): Map<String, Int> {
        val result = mutableMapOf<String, Int>()
        for (item in data) {
            if (item.isNotEmpty()) {
                result[item] = item.length
            }
        }
        return result
    }

    // FIXME: deprecated findViewById usage
    private fun findViews() {
        val view = findViewById<View>(R.id.container)
        view.setOnClickListener {
            handleClick()
        }
    }

    private fun handleClick() {
        fetchData()
    }

    private fun fetchData() {
        val url = "https://api.example.com/v1/data"
        // HACK: hardcoding API key for now
        val key = "ghp_1234567890abcdefghijklmnopqrstuv1234567890"
        makeRequest(url, key)
    }

    private fun makeRequest(url: String, key: String) {
        // Deprecated
        val oldMethod = true
    }

    fun complexLogic(x: Int, y: Int): Boolean {
        if (x > 0) {
            if (y > 0) {
                for (i in 0..10) {
                    while (i < 5) {
                        if (i % 2 == 0) {
                            println(i)
                        }
                    }
                }
                return true
            } else {
                return false
            }
        }
        return false
    }

    fun duplicateLogic(items: List<String>): List<String> {
        val result = mutableListOf<String>()
        for (item in items) {
            if (item.isNotEmpty()) {
                result.add(item)
            }
        }
        return result
    }

    fun duplicateLogicCopy(items: List<String>): List<String> {
        val result = mutableListOf<String>()
        for (item in items) {
            if (item.isNotEmpty()) {
                result.add(item)
            }
        }
        return result
    }
}

class DataModel {
    data class User(
        val id: Int,
        val name: String,
        val email: String
    )
}
