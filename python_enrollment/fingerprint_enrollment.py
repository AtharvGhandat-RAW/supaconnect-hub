"""
Fingerprint Enrollment Software
For R307 Fingerprint Sensor with Supabase Backend

This software allows enrolling student fingerprints and syncing them
with the attendance system database.
"""

import sys
import time
import serial
import serial.tools.list_ports
from typing import Optional, Tuple
import requests
import json

# Try to import GUI libraries
try:
    import tkinter as tk
    from tkinter import ttk, messagebox, simpledialog
    HAS_GUI = True
except ImportError:
    HAS_GUI = False
    print("Note: tkinter not available, running in CLI mode")

# Configuration - Update these values
SUPABASE_URL = "https://gphcfejuurygcetmtpec.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODM0ODAsImV4cCI6MjA4MDM1OTQ4MH0.NrHmxfRMW3E2SdiMEfNwbozGG36xpG1jroQB0dy3s5E"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzQ4MCwiZXhwIjoyMDgwMzU5NDgwfQ.EuzI5mIV6nu5H6mC3QYkQsbmdkqLEXuWIZlf2oiqZ7g"

# R307 Commands
R307_HEADER = bytes([0xEF, 0x01])
R307_ADDRESS = bytes([0xFF, 0xFF, 0xFF, 0xFF])
R307_PASSWORD = bytes([0x00, 0x00, 0x00, 0x00])

# Command codes
CMD_GENIMG = 0x01
CMD_IMG2TZ = 0x02
CMD_MATCH = 0x03
CMD_SEARCH = 0x04
CMD_REGMODEL = 0x05
CMD_STORE = 0x06
CMD_LOADCHAR = 0x07
CMD_UPCHAR = 0x08
CMD_DOWNCHAR = 0x09
CMD_UPIMAGE = 0x0A
CMD_DOWNIMAGE = 0x0B
CMD_DELETCHAR = 0x0C
CMD_EMPTY = 0x0D
CMD_SETSYSPARA = 0x0E
CMD_READSYSPARA = 0x0F
CMD_HISPEED = 0x10
CMD_VERIFYPASSWORD = 0x13
CMD_TEMPLATENUM = 0x1D
CMD_READINDEXTABLE = 0x1F

# Confirmation codes
FINGERPRINT_OK = 0x00
FINGERPRINT_NOFINGER = 0x02
FINGERPRINT_IMAGEFAIL = 0x03


class R307Sensor:
    """R307 Fingerprint Sensor Communication"""

    def __init__(self, port: str, baudrate: int = 57600):
        self.serial = serial.Serial(port, baudrate, timeout=2)
        time.sleep(0.5)

    def close(self):
        if self.serial and self.serial.is_open:
            self.serial.close()

    def _checksum(self, data: bytes) -> int:
        return sum(data) & 0xFFFF

    def _send_packet(self, packet_type: int, data: bytes) -> bool:
        length = len(data) + 2  # data + checksum
        packet = R307_HEADER + R307_ADDRESS + bytes([packet_type])
        packet += bytes([(length >> 8) & 0xFF, length & 0xFF])
        packet += data
        checksum = self._checksum(bytes([packet_type]) + bytes([(length >> 8) & 0xFF, length & 0xFF]) + data)
        packet += bytes([(checksum >> 8) & 0xFF, checksum & 0xFF])
        self.serial.write(packet)
        return True

    def _receive_packet(self, timeout: float = 2.0) -> Tuple[int, bytes]:
        start_time = time.time()
        buffer = bytearray()

        while time.time() - start_time < timeout:
            if self.serial.in_waiting > 0:
                buffer.extend(self.serial.read(self.serial.in_waiting))

            # Check if we have a complete packet
            if len(buffer) >= 12:
                # Find header
                try:
                    idx = buffer.index(0xEF)
                    if buffer[idx + 1] == 0x01:
                        # Found header at idx
                        if len(buffer) >= idx + 9:
                            length = (buffer[idx + 7] << 8) | buffer[idx + 8]
                            if len(buffer) >= idx + 9 + length:
                                packet_type = buffer[idx + 6]
                                data = bytes(buffer[idx + 9:idx + 9 + length - 2])
                                return packet_type, data
                except ValueError:
                    pass
            time.sleep(0.01)

        return 0, bytes()

    def verify_password(self) -> bool:
        """Verify sensor password"""
        self._send_packet(0x01, bytes([CMD_VERIFYPASSWORD]) + R307_PASSWORD)
        packet_type, data = self._receive_packet()
        return packet_type == 0x07 and len(data) > 0 and data[0] == FINGERPRINT_OK

    def get_template_count(self) -> int:
        """Get number of stored templates"""
        self._send_packet(0x01, bytes([CMD_TEMPLATENUM]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) >= 3 and data[0] == FINGERPRINT_OK:
            return (data[1] << 8) | data[2]
        return -1

    def capture_image(self) -> int:
        """Capture fingerprint image"""
        self._send_packet(0x01, bytes([CMD_GENIMG]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def image_to_tz(self, buffer_id: int = 1) -> int:
        """Convert image to character file"""
        self._send_packet(0x01, bytes([CMD_IMG2TZ, buffer_id]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def create_model(self) -> int:
        """Create model from character buffers"""
        self._send_packet(0x01, bytes([CMD_REGMODEL]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def store_model(self, buffer_id: int, location: int) -> int:
        """Store model in flash"""
        self._send_packet(0x01, bytes([CMD_STORE, buffer_id, (location >> 8) & 0xFF, location & 0xFF]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def search(self, buffer_id: int = 1, start: int = 0, count: int = 127) -> Tuple[int, int, int]:
        """Search for fingerprint, returns (result, finger_id, confidence)"""
        self._send_packet(0x01, bytes([
            CMD_SEARCH, buffer_id,
            (start >> 8) & 0xFF, start & 0xFF,
            (count >> 8) & 0xFF, count & 0xFF
        ]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) >= 5:
            result = data[0]
            finger_id = (data[1] << 8) | data[2]
            confidence = (data[3] << 8) | data[4]
            return result, finger_id, confidence
        return 0xFF, 0, 0

    def delete_model(self, location: int, count: int = 1) -> int:
        """Delete model from flash"""
        self._send_packet(0x01, bytes([
            CMD_DELETCHAR,
            (location >> 8) & 0xFF, location & 0xFF,
            (count >> 8) & 0xFF, count & 0xFF
        ]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def empty_database(self) -> int:
        """Delete all fingerprints"""
        self._send_packet(0x01, bytes([CMD_EMPTY]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def get_next_available_id(self) -> int:
        """Find next available storage location"""
        for i in range(1, 128):
            self._send_packet(0x01, bytes([CMD_LOADCHAR, 1, (i >> 8) & 0xFF, i & 0xFF]))
            packet_type, data = self._receive_packet()
            if packet_type == 0x07 and len(data) > 0 and data[0] != FINGERPRINT_OK:
                return i
        return -1


class SupabaseClient:
    """Supabase API Client"""

    def __init__(self, url: str, key: str, service_key: str = None):
        self.url = url.rstrip('/')
        self.key = key
        self.service_key = service_key or key

    def _headers(self, use_service: bool = False) -> dict:
        key = self.service_key if use_service else self.key
        return {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

    def verify_student(self, enrollment_no: str) -> Optional[dict]:
        """Verify student exists by enrollment number"""
        url = f"{self.url}/rest/v1/students"
        params = {
            'enrollment_no': f'eq.{enrollment_no}',
            'select': 'id,name,enrollment_no,year,semester,roll_no,division,class_id,classes(name,division)'
        }

        try:
            response = requests.get(url, headers=self._headers(), params=params)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0]
        except Exception as e:
            print(f"Error verifying student: {e}")
        return None

    def is_student_enrolled(self, student_id: str) -> bool:
        """Check if student already has fingerprint"""
        url = f"{self.url}/rest/v1/fingerprint_templates"
        params = {
            'student_id': f'eq.{student_id}',
            'select': 'id'
        }

        try:
            response = requests.get(url, headers=self._headers(), params=params)
            if response.status_code == 200:
                data = response.json()
                return len(data) > 0
        except Exception as e:
            print(f"Error checking enrollment: {e}")
        return False

    def save_fingerprint(self, student_id: str, fingerprint_id: int) -> bool:
        """Save fingerprint template mapping"""
        url = f"{self.url}/rest/v1/fingerprint_templates"
        data = {
            'student_id': student_id,
            'fingerprint_id': fingerprint_id,
            'is_verified': True
        }

        try:
            response = requests.post(url, headers=self._headers(use_service=True), json=data)
            return response.status_code in [200, 201]
        except Exception as e:
            print(f"Error saving fingerprint: {e}")
        return False

    def delete_fingerprint(self, student_id: str) -> bool:
        """Delete fingerprint mapping"""
        url = f"{self.url}/rest/v1/fingerprint_templates"
        params = {'student_id': f'eq.{student_id}'}

        try:
            response = requests.delete(url, headers=self._headers(use_service=True), params=params)
            return response.status_code in [200, 204]
        except Exception as e:
            print(f"Error deleting fingerprint: {e}")
        return False

    def get_all_students(self, class_id: str = None) -> list:
        """Get all students, optionally filtered by class"""
        url = f"{self.url}/rest/v1/students"
        params = {
            'status': 'eq.ACTIVE',
            'select': 'id,name,enrollment_no,roll_no,class_id,classes(name,division)',
            'order': 'roll_no.asc'
        }
        if class_id:
            params['class_id'] = f'eq.{class_id}'

        try:
            response = requests.get(url, headers=self._headers(), params=params)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error fetching students: {e}")
        return []


class FingerprintEnrollmentCLI:
    """Command Line Interface for Fingerprint Enrollment"""

    def __init__(self):
        self.sensor: Optional[R307Sensor] = None
        self.supabase: Optional[SupabaseClient] = None

    def find_sensor_port(self) -> Optional[str]:
        """Find R307 sensor port"""
        ports = serial.tools.list_ports.comports()
        for port in ports:
            print(f"Found port: {port.device} - {port.description}")

        # Try common ports
        common_ports = ['/dev/ttyUSB0', '/dev/ttyACM0', 'COM3', 'COM4', 'COM5']
        for port in common_ports:
            try:
                ser = serial.Serial(port, 57600, timeout=1)
                ser.close()
                return port
            except:
                continue

        if ports:
            return ports[0].device
        return None

    def connect(self, port: str = None):
        """Connect to sensor and Supabase"""
        # Connect to sensor
        if not port:
            port = self.find_sensor_port()

        if not port:
            print("ERROR: No serial port found!")
            return False

        print(f"Connecting to R307 on {port}...")
        try:
            self.sensor = R307Sensor(port)
            if self.sensor.verify_password():
                print("Sensor connected successfully!")
                count = self.sensor.get_template_count()
                print(f"Stored fingerprints: {count}")
            else:
                print("ERROR: Sensor password verification failed!")
                return False
        except Exception as e:
            print(f"ERROR: Failed to connect to sensor: {e}")
            return False

        # Connect to Supabase
        print("Connecting to Supabase...")
        self.supabase = SupabaseClient(SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY)
        print("Supabase client ready")

        return True

    def enroll_fingerprint(self):
        """Enroll a new fingerprint"""
        if not self.sensor or not self.supabase:
            print("ERROR: Not connected!")
            return

        # Get enrollment number
        enrollment_no = input("Enter Student Enrollment Number: ").strip()
        if not enrollment_no:
            print("Cancelled.")
            return

        # Verify student
        print("Verifying student...")
        student = self.supabase.verify_student(enrollment_no)
        if not student:
            print("ERROR: Student not found in database!")
            return

        print(f"\nStudent Found:")
        print(f"  Name: {student.get('name')}")
        print(f"  Roll No: {student.get('roll_no')}")
        print(f"  Class: {student.get('classes', {}).get('name', 'N/A')} {student.get('classes', {}).get('division', '')}")
        print(f"  Year: {student.get('year')}, Semester: {student.get('semester')}")

        # Check if already enrolled
        if self.supabase.is_student_enrolled(student['id']):
            print("\nWARNING: Student already has fingerprint enrolled!")
            overwrite = input("Overwrite? (y/n): ").strip().lower()
            if overwrite != 'y':
                print("Cancelled.")
                return
            # Delete existing
            self.supabase.delete_fingerprint(student['id'])

        # Get next available ID
        fp_id = self.sensor.get_next_available_id()
        if fp_id < 0:
            print("ERROR: Fingerprint database full!")
            return

        print(f"\nUsing fingerprint ID: {fp_id}")
        print("\n=== FINGERPRINT ENROLLMENT ===")

        # Capture first image
        print("\nStep 1: Place your finger on the sensor...")
        while True:
            result = self.sensor.capture_image()
            if result == FINGERPRINT_OK:
                print("Image captured!")
                break
            elif result == FINGERPRINT_NOFINGER:
                time.sleep(0.1)
            else:
                print(f"Error capturing image: {result}")
                return

        # Convert to template 1
        result = self.sensor.image_to_tz(1)
        if result != FINGERPRINT_OK:
            print(f"Error converting image: {result}")
            return
        print("First fingerprint recorded.")

        # Wait for finger removal
        print("\nRemove your finger...")
        while self.sensor.capture_image() != FINGERPRINT_NOFINGER:
            time.sleep(0.1)
        time.sleep(0.5)

        # Capture second image
        print("\nStep 2: Place the SAME finger again...")
        while True:
            result = self.sensor.capture_image()
            if result == FINGERPRINT_OK:
                print("Image captured!")
                break
            elif result == FINGERPRINT_NOFINGER:
                time.sleep(0.1)
            else:
                print(f"Error capturing image: {result}")
                return

        # Convert to template 2
        result = self.sensor.image_to_tz(2)
        if result != FINGERPRINT_OK:
            print(f"Error converting image: {result}")
            return
        print("Second fingerprint recorded.")

        # Create model
        result = self.sensor.create_model()
        if result != FINGERPRINT_OK:
            print("ERROR: Fingerprints don't match! Please try again.")
            return
        print("Fingerprints matched!")

        # Store model
        result = self.sensor.store_model(1, fp_id)
        if result != FINGERPRINT_OK:
            print(f"Error storing fingerprint: {result}")
            return
        print(f"Fingerprint stored at ID {fp_id}")

        # Save to database
        print("\nSyncing to database...")
        if self.supabase.save_fingerprint(student['id'], fp_id):
            print("\n SUCCESS! Fingerprint enrolled successfully!")
            print(f"  Student: {student.get('name')}")
            print(f"  Fingerprint ID: {fp_id}")
        else:
            print("ERROR: Failed to save to database!")
            # Rollback - delete from sensor
            self.sensor.delete_model(fp_id)

    def verify_fingerprint(self):
        """Verify a fingerprint"""
        if not self.sensor:
            print("ERROR: Not connected!")
            return

        print("\nPlace your finger on the sensor...")
        while True:
            result = self.sensor.capture_image()
            if result == FINGERPRINT_OK:
                break
            elif result == FINGERPRINT_NOFINGER:
                time.sleep(0.1)
            else:
                print(f"Error: {result}")
                return

        result = self.sensor.image_to_tz(1)
        if result != FINGERPRINT_OK:
            print(f"Error: {result}")
            return

        result, fp_id, confidence = self.sensor.search()
        if result == FINGERPRINT_OK:
            print(f"\n MATCH FOUND!")
            print(f"  Fingerprint ID: {fp_id}")
            print(f"  Confidence: {confidence}")
        else:
            print("\n NO MATCH - Fingerprint not registered")

    def delete_fingerprint(self):
        """Delete a fingerprint"""
        if not self.sensor:
            print("ERROR: Not connected!")
            return

        fp_id = input("Enter Fingerprint ID to delete (or 'all' to clear): ").strip()

        if fp_id.lower() == 'all':
            confirm = input("Delete ALL fingerprints? (type 'yes' to confirm): ")
            if confirm.lower() == 'yes':
                result = self.sensor.empty_database()
                if result == FINGERPRINT_OK:
                    print("All fingerprints deleted!")
                else:
                    print(f"Error: {result}")
        else:
            try:
                fp_id = int(fp_id)
                result = self.sensor.delete_model(fp_id)
                if result == FINGERPRINT_OK:
                    print(f"Fingerprint {fp_id} deleted!")
                else:
                    print(f"Error: {result}")
            except ValueError:
                print("Invalid ID")

    def run(self):
        """Run the CLI application"""
        print("\n" + "="*50)
        print("  FINGERPRINT ENROLLMENT SYSTEM")
        print("  R307 Sensor + Supabase Backend")
        print("="*50 + "\n")

        # Connect
        port = input("Enter serial port (leave blank for auto-detect): ").strip() or None
        if not self.connect(port):
            return

        # Main menu
        while True:
            print("\n" + "-"*30)
            print("MENU:")
            print("  1. Enroll new fingerprint")
            print("  2. Verify fingerprint")
            print("  3. Delete fingerprint")
            print("  4. Show stored count")
            print("  5. Exit")
            print("-"*30)

            choice = input("Select option: ").strip()

            if choice == '1':
                self.enroll_fingerprint()
            elif choice == '2':
                self.verify_fingerprint()
            elif choice == '3':
                self.delete_fingerprint()
            elif choice == '4':
                count = self.sensor.get_template_count()
                print(f"Stored fingerprints: {count}")
            elif choice == '5':
                break
            else:
                print("Invalid option")

        # Cleanup
        if self.sensor:
            self.sensor.close()
        print("\nGoodbye!")


if __name__ == "__main__":
    app = FingerprintEnrollmentCLI()
    app.run()
