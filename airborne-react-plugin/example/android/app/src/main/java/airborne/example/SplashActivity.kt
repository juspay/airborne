package airborne.example

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {
    var hasBootCompleted = false
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)

        if (applicationContext is MainApplication) {
            (applicationContext as MainApplication).bootCompleteListener = {
                startMainActivity()
            }
            if ((applicationContext as MainApplication).isBootComplete) {
                startMainActivity()
            }
        }
    }

    private fun startMainActivity() {
        synchronized(this) {
            if (hasBootCompleted) return
            hasBootCompleted = true
        }
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
