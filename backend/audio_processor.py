import speech_recognition as sr
import os
import io

def process_audio(audio_file):
    """
    Converts audio file blob to text using SpeechRecognition
    """
    recognizer = sr.Recognizer()
    try:
        # Load audio into memory
        # Depending on browser (WebM/WAV) it requires pydub or works natively
        # browsers send WAV / WEBM, Native Python SpeechRecognition only likes WAV/AIFF/FLAC
        # we can just pass the file handle
        with sr.AudioFile(audio_file) as source:
            audio_data = recognizer.record(source)
            
            # Recognize using Google's free API
            text = recognizer.recognize_google(audio_data)
            return text
    except sr.UnknownValueError:
        print("Google Speech Recognition could not understand audio")
        return None
    except sr.RequestError as e:
        print(f"Could not request results from Google Speech Recognition service; {e}")
        return None
    except Exception as e:
        print(f"Error processing audio: {e}")
        return None
