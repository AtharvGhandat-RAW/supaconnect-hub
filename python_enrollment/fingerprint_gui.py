"""
Fingerprint Enrollment GUI Application
For R307 Fingerprint Sensor with Supabase Backend

A graphical interface for enrolling student fingerprints
"""

import sys
import time
import threading
import serial
import serial.tools.list_ports
from typing import Optional, Tuple
import requests
import json

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from tkinter.font import Font

# ==================== CONFIGURATION ====================
# Update these values before running
CONFIG = {
    "SUPABASE_URL": "https://gphcfejuurygcetmtpec.supabase.co",
    "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODM0ODAsImV4cCI6MjA4MDM1OTQ4MH0.NrHmxfRMW3E2SdiMEfNwbozGG36xpG1jroQB0dy3s5E",
    "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzQ4MCwiZXhwIjoyMDgwMzU5NDgwfQ.EuzI5mIV6nu5H6mC3QYkQsbmdkqLEXuWIZlf2oiqZ7g",
    "BAUD_RATE": 57600,
    "BAUD_RATES": [57600, 115200, 38400]
}

# ==================== R307 SENSOR CLASS ====================
class R307Sensor:
    """R307 Fingerprint Sensor Communication"""

    FINGERPRINT_OK = 0x00
    FINGERPRINT_NOFINGER = 0x02
    FINGERPRINT_IMAGEFAIL = 0x03
    FINGERPRINT_IMAGEMESS = 0x06
    FINGERPRINT_FEATUREFAIL = 0x07
    FINGERPRINT_NOMATCH = 0x08
    FINGERPRINT_NOTFOUND = 0x09
    FINGERPRINT_ENROLLMISMATCH = 0x0A
    FINGERPRINT_BADLOCATION = 0x0B
    FINGERPRINT_FLASHERR = 0x18

    def __init__(self, port: str, baudrate: int = 57600):
        self.serial = serial.Serial(port, baudrate, timeout=2, write_timeout=2)
        self.baudrate = baudrate
        self.address = bytes([0xFF, 0xFF, 0xFF, 0xFF])
        time.sleep(0.2)
        self.serial.reset_input_buffer()
        self.serial.reset_output_buffer()

    def close(self):
        if self.serial and self.serial.is_open:
            self.serial.close()

    def _send_packet(self, packet_type: int, data: bytes) -> bool:
        header = bytes([0xEF, 0x01])
        length = len(data) + 2
        packet = header + self.address + bytes([packet_type])
        packet += bytes([(length >> 8) & 0xFF, length & 0xFF])
        packet += data
        checksum = packet_type + (length >> 8) + (length & 0xFF) + sum(data)
        packet += bytes([(checksum >> 8) & 0xFF, checksum & 0xFF])
        self.serial.write(packet)
        return True

    def _receive_packet(self, timeout: float = 3.0) -> Tuple[int, bytes]:
        start_time = time.time()
        buffer = bytearray()

        while time.time() - start_time < timeout:
            if self.serial.in_waiting > 0:
                buffer.extend(self.serial.read(self.serial.in_waiting))

            if len(buffer) >= 12:
                try:
                    idx = buffer.index(0xEF)
                    if idx + 1 < len(buffer) and buffer[idx + 1] == 0x01:
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
        self._send_packet(0x01, bytes([0x13, 0x00, 0x00, 0x00, 0x00]))
        packet_type, data = self._receive_packet()
        return packet_type == 0x07 and len(data) > 0 and data[0] == self.FINGERPRINT_OK

    @classmethod
    def connect_with_auto_baud(cls, port: str, baud_rates: list) -> Tuple[Optional['R307Sensor'], int]:
        """Try common baud rates and return the first verified sensor connection."""
        for baud in baud_rates:
            sensor = None
            try:
                sensor = cls(port, baud)
                if sensor.verify_password():
                    return sensor, baud
            except Exception:
                pass
            finally:
                if sensor:
                    sensor.close()
        return None, 0

    def get_template_count(self) -> int:
        self._send_packet(0x01, bytes([0x1D]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) >= 3 and data[0] == self.FINGERPRINT_OK:
            return (data[1] << 8) | data[2]
        return -1

    def capture_image(self) -> int:
        self._send_packet(0x01, bytes([0x01]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def image_to_tz(self, buffer_id: int = 1) -> int:
        self._send_packet(0x01, bytes([0x02, buffer_id]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def create_model(self) -> int:
        self._send_packet(0x01, bytes([0x05]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def store_model(self, buffer_id: int, location: int) -> int:
        self._send_packet(0x01, bytes([0x06, buffer_id, (location >> 8) & 0xFF, location & 0xFF]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def search(self, buffer_id: int = 1, start: int = 0, count: int = 127) -> Tuple[int, int, int]:
        self._send_packet(0x01, bytes([
            0x04, buffer_id,
            (start >> 8) & 0xFF, start & 0xFF,
            (count >> 8) & 0xFF, count & 0xFF
        ]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) >= 5:
            return data[0], (data[1] << 8) | data[2], (data[3] << 8) | data[4]
        return 0xFF, 0, 0

    def delete_model(self, location: int, count: int = 1) -> int:
        self._send_packet(0x01, bytes([
            0x0C, (location >> 8) & 0xFF, location & 0xFF,
            (count >> 8) & 0xFF, count & 0xFF
        ]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def empty_database(self) -> int:
        self._send_packet(0x01, bytes([0x0D]))
        packet_type, data = self._receive_packet()
        if packet_type == 0x07 and len(data) > 0:
            return data[0]
        return 0xFF

    def get_next_available_id(self) -> int:
        for i in range(1, 128):
            self._send_packet(0x01, bytes([0x07, 1, (i >> 8) & 0xFF, i & 0xFF]))
            packet_type, data = self._receive_packet()
            if packet_type == 0x07 and len(data) > 0 and data[0] != self.FINGERPRINT_OK:
                return i
        return -1


# ==================== SUPABASE CLIENT ====================
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
        url = f"{self.url}/rest/v1/students"
        params = {
            'enrollment_no': f'eq.{enrollment_no}',
            'select': 'id,name,enrollment_no,year,semester,roll_no,division,class_id,classes(name,division)'
        }
        try:
            response = requests.get(url, headers=self._headers(), params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    return data[0]
        except Exception as e:
            print(f"Error: {e}")
        return None

    def is_student_enrolled(self, student_id: str) -> bool:
        url = f"{self.url}/rest/v1/fingerprint_templates"
        params = {'student_id': f'eq.{student_id}', 'select': 'id'}
        try:
            response = requests.get(url, headers=self._headers(), params=params, timeout=10)
            if response.status_code == 200:
                return len(response.json()) > 0
        except:
            pass
        return False

    def save_fingerprint(self, student_id: str, fingerprint_id: int) -> bool:
        url = f"{self.url}/rest/v1/fingerprint_templates"
        data = {'student_id': student_id, 'fingerprint_id': fingerprint_id, 'is_verified': True}
        try:
            response = requests.post(url, headers=self._headers(use_service=True), json=data, timeout=10)
            return response.status_code in [200, 201]
        except:
            pass
        return False

    def delete_fingerprint(self, student_id: str) -> bool:
        url = f"{self.url}/rest/v1/fingerprint_templates"
        params = {'student_id': f'eq.{student_id}'}
        try:
            response = requests.delete(url, headers=self._headers(use_service=True), params=params, timeout=10)
            return response.status_code in [200, 204]
        except:
            pass
        return False

    def get_all_enrolled(self) -> list:
        url = f"{self.url}/rest/v1/fingerprint_templates"
        params = {'select': 'id,fingerprint_id,students(name,enrollment_no,roll_no)'}
        try:
            response = requests.get(url, headers=self._headers(), params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return []


# ==================== GUI APPLICATION ====================
class FingerprintEnrollmentApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Fingerprint Enrollment System")
        self.root.geometry("900x700")
        self.root.minsize(800, 600)

        # Variables
        self.sensor: Optional[R307Sensor] = None
        self.supabase: Optional[SupabaseClient] = None
        self.is_connected = False
        self.current_student = None
        self.enrollment_step = 0
        self.connected_baud = 0

        # Styling
        self.style = ttk.Style()
        self.style.theme_use('clam')

        # Colors
        self.colors = {
            'primary': '#3B82F6',
            'success': '#10B981',
            'danger': '#EF4444',
            'warning': '#F59E0B',
            'bg': '#1F2937',
            'card': '#374151',
            'text': '#F9FAFB',
            'muted': '#9CA3AF'
        }

        self.root.configure(bg=self.colors['bg'])

        # Configure styles
        self.configure_styles()

        # Build UI
        self.create_ui()

        # Initialize Supabase
        self.supabase = SupabaseClient(
            CONFIG['SUPABASE_URL'],
            CONFIG['SUPABASE_KEY'],
            CONFIG['SUPABASE_SERVICE_KEY']
        )

    def configure_styles(self):
        self.style.configure('TFrame', background=self.colors['bg'])
        self.style.configure('Card.TFrame', background=self.colors['card'])
        self.style.configure('TLabel', background=self.colors['bg'], foreground=self.colors['text'])
        self.style.configure('Card.TLabel', background=self.colors['card'], foreground=self.colors['text'])
        self.style.configure('Title.TLabel', font=('Segoe UI', 24, 'bold'))
        self.style.configure('Subtitle.TLabel', font=('Segoe UI', 12), foreground=self.colors['muted'])
        self.style.configure('Status.TLabel', font=('Segoe UI', 11))

        self.style.configure('Primary.TButton', font=('Segoe UI', 11, 'bold'))
        self.style.configure('Success.TButton', font=('Segoe UI', 11, 'bold'))
        self.style.configure('Danger.TButton', font=('Segoe UI', 11, 'bold'))

    def create_ui(self):
        # Main container
        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))

        ttk.Label(header_frame, text="Fingerprint Enrollment", style='Title.TLabel').pack(side=tk.LEFT)

        # Connection status
        self.status_label = ttk.Label(header_frame, text="● Disconnected", style='Status.TLabel', foreground=self.colors['danger'])
        self.status_label.pack(side=tk.RIGHT)

        # Content area - two columns
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)

        # Left column - Connection & Controls
        left_frame = ttk.Frame(content_frame, width=350)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_frame.pack_propagate(False)

        # Connection Card
        self.create_connection_card(left_frame)

        # Action Buttons Card
        self.create_actions_card(left_frame)

        # Right column - Main content
        right_frame = ttk.Frame(content_frame)
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Enrollment Card
        self.create_enrollment_card(right_frame)

        # Log Card
        self.create_log_card(right_frame)

    def create_card(self, parent, title):
        """Create a styled card frame"""
        card = tk.Frame(parent, bg=self.colors['card'], padx=15, pady=15)
        card.pack(fill=tk.X, pady=(0, 10))

        title_label = tk.Label(card, text=title, font=('Segoe UI', 14, 'bold'),
                              bg=self.colors['card'], fg=self.colors['text'])
        title_label.pack(anchor=tk.W, pady=(0, 10))

        content = tk.Frame(card, bg=self.colors['card'])
        content.pack(fill=tk.X)

        return content

    def create_connection_card(self, parent):
        content = self.create_card(parent, "🔌 Connection")

        # Port selection
        port_frame = tk.Frame(content, bg=self.colors['card'])
        port_frame.pack(fill=tk.X, pady=(0, 10))

        tk.Label(port_frame, text="Serial Port:", bg=self.colors['card'], fg=self.colors['text']).pack(anchor=tk.W)

        port_row = tk.Frame(port_frame, bg=self.colors['card'])
        port_row.pack(fill=tk.X, pady=(5, 0))

        self.port_combo = ttk.Combobox(port_row, width=20)
        self.port_combo.pack(side=tk.LEFT, padx=(0, 5))

        refresh_btn = tk.Button(port_row, text="↻", command=self.refresh_ports,
                               bg=self.colors['primary'], fg='white', width=3)
        refresh_btn.pack(side=tk.LEFT)

        # Connect button
        self.connect_btn = tk.Button(content, text="Connect", command=self.toggle_connection,
                                    bg=self.colors['primary'], fg='white', font=('Segoe UI', 11, 'bold'),
                                    width=20, height=2)
        self.connect_btn.pack(pady=10)

        # Sensor info
        self.sensor_info = tk.Label(content, text="Sensor: Not connected",
                                   bg=self.colors['card'], fg=self.colors['muted'])
        self.sensor_info.pack(anchor=tk.W)

        tip_text = "Tip: Put ESP32 in BRIDGE mode (hold BOOT during reset), then connect."
        self.bridge_tip = tk.Label(content, text=tip_text,
                       bg=self.colors['card'], fg=self.colors['muted'],
                       font=('Segoe UI', 9), wraplength=260, justify=tk.LEFT)
        self.bridge_tip.pack(anchor=tk.W, pady=(8, 0))

        # Refresh ports on start
        self.refresh_ports()

    def create_actions_card(self, parent):
        content = self.create_card(parent, "⚡ Quick Actions")

        buttons = [
            ("🔍 Verify Fingerprint", self.verify_fingerprint, self.colors['primary']),
            ("📋 View Enrolled", self.view_enrolled, self.colors['primary']),
            ("🗑️ Delete Single", self.delete_single, self.colors['warning']),
            ("⚠️ Clear All", self.clear_all, self.colors['danger']),
        ]

        for text, command, color in buttons:
            btn = tk.Button(content, text=text, command=command,
                           bg=color, fg='white', font=('Segoe UI', 10),
                           width=25, height=1, anchor='w', padx=10)
            btn.pack(pady=3)

    def create_enrollment_card(self, parent):
        card = tk.Frame(parent, bg=self.colors['card'], padx=20, pady=20)
        card.pack(fill=tk.X, pady=(0, 10))

        tk.Label(card, text="📝 Enroll New Fingerprint", font=('Segoe UI', 16, 'bold'),
                bg=self.colors['card'], fg=self.colors['text']).pack(anchor=tk.W, pady=(0, 15))

        # Enrollment number input
        input_frame = tk.Frame(card, bg=self.colors['card'])
        input_frame.pack(fill=tk.X, pady=(0, 15))

        tk.Label(input_frame, text="Enrollment Number:", bg=self.colors['card'],
                fg=self.colors['text'], font=('Segoe UI', 11)).pack(anchor=tk.W)

        entry_row = tk.Frame(input_frame, bg=self.colors['card'])
        entry_row.pack(fill=tk.X, pady=(5, 0))

        self.enrollment_entry = tk.Entry(entry_row, font=('Segoe UI', 14), width=25)
        self.enrollment_entry.pack(side=tk.LEFT, padx=(0, 10))
        self.enrollment_entry.bind('<Return>', lambda e: self.verify_student())

        self.verify_btn = tk.Button(entry_row, text="Verify", command=self.verify_student,
                                   bg=self.colors['primary'], fg='white', font=('Segoe UI', 10, 'bold'))
        self.verify_btn.pack(side=tk.LEFT)

        # Student info display
        self.student_frame = tk.Frame(card, bg='#4B5563', padx=15, pady=15)
        self.student_frame.pack(fill=tk.X, pady=(0, 15))

        self.student_name = tk.Label(self.student_frame, text="No student verified",
                                    font=('Segoe UI', 14, 'bold'), bg='#4B5563', fg=self.colors['text'])
        self.student_name.pack(anchor=tk.W)

        self.student_details = tk.Label(self.student_frame, text="Enter enrollment number above",
                                       font=('Segoe UI', 10), bg='#4B5563', fg=self.colors['muted'])
        self.student_details.pack(anchor=tk.W)

        # Fingerprint capture area
        capture_frame = tk.Frame(card, bg=self.colors['card'])
        capture_frame.pack(fill=tk.X)

        self.fingerprint_canvas = tk.Canvas(capture_frame, width=200, height=200,
                                           bg='#1F2937', highlightthickness=2,
                                           highlightbackground=self.colors['muted'])
        self.fingerprint_canvas.pack(pady=10)

        self.capture_status = tk.Label(capture_frame, text="Ready",
                                      font=('Segoe UI', 12), bg=self.colors['card'], fg=self.colors['text'])
        self.capture_status.pack()

        # Progress indicator
        self.progress_frame = tk.Frame(capture_frame, bg=self.colors['card'])
        self.progress_frame.pack(fill=tk.X, pady=10)

        self.step1_label = tk.Label(self.progress_frame, text="① First Scan",
                                   font=('Segoe UI', 10), bg=self.colors['card'], fg=self.colors['muted'])
        self.step1_label.pack(side=tk.LEFT, expand=True)

        self.step2_label = tk.Label(self.progress_frame, text="② Second Scan",
                                   font=('Segoe UI', 10), bg=self.colors['card'], fg=self.colors['muted'])
        self.step2_label.pack(side=tk.LEFT, expand=True)

        self.step3_label = tk.Label(self.progress_frame, text="③ Save",
                                   font=('Segoe UI', 10), bg=self.colors['card'], fg=self.colors['muted'])
        self.step3_label.pack(side=tk.LEFT, expand=True)

        # Enroll button
        self.enroll_btn = tk.Button(capture_frame, text="Start Enrollment", command=self.start_enrollment,
                                   bg=self.colors['success'], fg='white', font=('Segoe UI', 12, 'bold'),
                                   width=20, height=2, state=tk.DISABLED)
        self.enroll_btn.pack(pady=10)

    def create_log_card(self, parent):
        card = tk.Frame(parent, bg=self.colors['card'], padx=15, pady=15)
        card.pack(fill=tk.BOTH, expand=True)

        tk.Label(card, text="📜 Activity Log", font=('Segoe UI', 12, 'bold'),
                bg=self.colors['card'], fg=self.colors['text']).pack(anchor=tk.W, pady=(0, 10))

        self.log_text = scrolledtext.ScrolledText(card, height=8, font=('Consolas', 9),
                                                  bg='#1F2937', fg=self.colors['text'],
                                                  insertbackground=self.colors['text'])
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def log(self, message: str, level: str = "info"):
        timestamp = time.strftime("%H:%M:%S")
        prefix = {"info": "ℹ️", "success": "✅", "error": "❌", "warning": "⚠️"}.get(level, "•")
        self.log_text.insert(tk.END, f"[{timestamp}] {prefix} {message}\n")
        self.log_text.see(tk.END)

    def refresh_ports(self):
        ports = [p.device for p in serial.tools.list_ports.comports()]
        self.port_combo['values'] = ports
        if ports:
            self.port_combo.current(0)
        self.log("Refreshed serial ports")

    def toggle_connection(self):
        if self.is_connected:
            self.disconnect()
        else:
            self.connect()

    def connect(self):
        port = self.port_combo.get()
        if not port:
            messagebox.showerror("Error", "Please select a serial port")
            return

        self.log(f"Connecting to {port}...")

        try:
            self.sensor, self.connected_baud = R307Sensor.connect_with_auto_baud(
                port,
                CONFIG.get('BAUD_RATES', [CONFIG.get('BAUD_RATE', 57600)])
            )

            if self.sensor:
                self.is_connected = True
                count = self.sensor.get_template_count()

                self.status_label.config(text="● Connected", foreground=self.colors['success'])
                self.connect_btn.config(text="Disconnect", bg=self.colors['danger'])
                self.sensor_info.config(text=f"Sensor: {port} @ {self.connected_baud} | Fingerprints: {count}")

                self.log(f"Connected successfully at {self.connected_baud} baud. Stored fingerprints: {count}", "success")
            else:
                self.sensor = None
                self.connected_baud = 0
                err = (
                    "Sensor password verification failed.\n\n"
                    "Try these steps:\n"
                    "1) Put ESP32 in BRIDGE mode (hold BOOT while reset/power on).\n"
                    "2) Close Serial Monitor and any other COM-port app.\n"
                    "3) Ensure R307 power is 5V (VIN), GND common, TX->GPIO16, RX->GPIO17.\n"
                    "4) Reconnect and try again."
                )
                messagebox.showerror("Connection Failed", err)
                self.log("Connection failed - no valid response on any baud (57600/115200/38400)", "error")

        except Exception as e:
            self.log(f"Connection error: {e}", "error")
            messagebox.showerror("Error", f"Failed to connect:\n{e}")

    def disconnect(self):
        if self.sensor:
            self.sensor.close()
            self.sensor = None

        self.is_connected = False
        self.connected_baud = 0
        self.status_label.config(text="● Disconnected", foreground=self.colors['danger'])
        self.connect_btn.config(text="Connect", bg=self.colors['primary'])
        self.sensor_info.config(text="Sensor: Not connected")
        self.log("Disconnected from sensor")

    def verify_student(self):
        enrollment_no = self.enrollment_entry.get().strip()
        if not enrollment_no:
            messagebox.showwarning("Warning", "Please enter an enrollment number")
            return

        self.log(f"Verifying student: {enrollment_no}")
        self.verify_btn.config(state=tk.DISABLED)

        def verify_thread():
            student = self.supabase.verify_student(enrollment_no)

            self.root.after(0, lambda: self.handle_verify_result(student, enrollment_no))

        threading.Thread(target=verify_thread, daemon=True).start()

    def handle_verify_result(self, student, enrollment_no):
        self.verify_btn.config(state=tk.NORMAL)

        if student:
            self.current_student = student
            name = student.get('name', 'Unknown')
            roll = student.get('roll_no', 'N/A')
            year = student.get('year', 'N/A')
            semester = student.get('semester', 'N/A')

            class_info = student.get('classes', {})
            class_name = f"{class_info.get('name', '')} {class_info.get('division', '')}"

            self.student_name.config(text=name)
            self.student_details.config(text=f"Roll: {roll} | Class: {class_name} | Year: {year}, Sem: {semester}")
            self.student_frame.config(bg='#065F46')
            self.student_name.config(bg='#065F46')
            self.student_details.config(bg='#065F46')

            # Check if already enrolled
            if self.supabase.is_student_enrolled(student['id']):
                self.log(f"Student {name} already has fingerprint enrolled", "warning")
                self.enroll_btn.config(text="Re-Enroll (Overwrite)", state=tk.NORMAL if self.is_connected else tk.DISABLED)
            else:
                self.enroll_btn.config(text="Start Enrollment", state=tk.NORMAL if self.is_connected else tk.DISABLED)

            self.log(f"Student verified: {name}", "success")

        else:
            self.current_student = None
            self.student_name.config(text="Student not found!")
            self.student_details.config(text=f"No student with enrollment: {enrollment_no}")
            self.student_frame.config(bg='#7F1D1D')
            self.student_name.config(bg='#7F1D1D')
            self.student_details.config(bg='#7F1D1D')
            self.enroll_btn.config(state=tk.DISABLED)

            self.log(f"Student not found: {enrollment_no}", "error")

    def start_enrollment(self):
        if not self.is_connected or not self.current_student:
            return

        self.enroll_btn.config(state=tk.DISABLED)
        self.enrollment_step = 0

        # Reset progress indicators
        for label in [self.step1_label, self.step2_label, self.step3_label]:
            label.config(fg=self.colors['muted'])

        threading.Thread(target=self.enrollment_process, daemon=True).start()

    def enrollment_process(self):
        student = self.current_student

        # Check and delete existing if needed
        if self.supabase.is_student_enrolled(student['id']):
            self.log("Removing existing fingerprint...", "warning")
            self.supabase.delete_fingerprint(student['id'])

        # Get next available ID
        fp_id = self.sensor.get_next_available_id()
        if fp_id < 0:
            self.root.after(0, lambda: self.enrollment_error("Fingerprint database is full!"))
            return

        self.log(f"Using fingerprint ID: {fp_id}")

        # Step 1: First capture
        self.root.after(0, lambda: self.update_capture_status("Place finger on sensor...", 1))

        timeout = time.time() + 15
        while time.time() < timeout:
            result = self.sensor.capture_image()
            if result == R307Sensor.FINGERPRINT_OK:
                break
            elif result == R307Sensor.FINGERPRINT_NOFINGER:
                time.sleep(0.1)
            else:
                self.root.after(0, lambda: self.enrollment_error(f"Capture error: {result}"))
                return
        else:
            self.root.after(0, lambda: self.enrollment_error("Timeout - no finger detected"))
            return

        result = self.sensor.image_to_tz(1)
        if result != R307Sensor.FINGERPRINT_OK:
            self.root.after(0, lambda: self.enrollment_error("Failed to process fingerprint"))
            return

        self.root.after(0, lambda: self.update_capture_status("First scan OK! Remove finger...", 1, True))
        self.log("First fingerprint captured", "success")

        # Wait for finger removal
        while self.sensor.capture_image() != R307Sensor.FINGERPRINT_NOFINGER:
            time.sleep(0.1)
        time.sleep(0.5)

        # Step 2: Second capture
        self.root.after(0, lambda: self.update_capture_status("Place SAME finger again...", 2))

        timeout = time.time() + 15
        while time.time() < timeout:
            result = self.sensor.capture_image()
            if result == R307Sensor.FINGERPRINT_OK:
                break
            elif result == R307Sensor.FINGERPRINT_NOFINGER:
                time.sleep(0.1)
            else:
                self.root.after(0, lambda: self.enrollment_error("Capture error"))
                return
        else:
            self.root.after(0, lambda: self.enrollment_error("Timeout"))
            return

        result = self.sensor.image_to_tz(2)
        if result != R307Sensor.FINGERPRINT_OK:
            self.root.after(0, lambda: self.enrollment_error("Failed to process"))
            return

        self.root.after(0, lambda: self.update_capture_status("Second scan OK!", 2, True))
        self.log("Second fingerprint captured", "success")

        # Create model
        result = self.sensor.create_model()
        if result != R307Sensor.FINGERPRINT_OK:
            self.root.after(0, lambda: self.enrollment_error("Fingerprints don't match! Try again."))
            return

        # Store model
        result = self.sensor.store_model(1, fp_id)
        if result != R307Sensor.FINGERPRINT_OK:
            self.root.after(0, lambda: self.enrollment_error("Failed to store fingerprint"))
            return

        self.log(f"Fingerprint stored at ID {fp_id}")

        # Step 3: Save to database
        self.root.after(0, lambda: self.update_capture_status("Saving to database...", 3))

        if self.supabase.save_fingerprint(student['id'], fp_id):
            self.root.after(0, lambda: self.enrollment_success(student['name'], fp_id))
        else:
            # Rollback
            self.sensor.delete_model(fp_id)
            self.root.after(0, lambda: self.enrollment_error("Failed to save to database"))

    def update_capture_status(self, message: str, step: int, completed: bool = False):
        self.capture_status.config(text=message)

        labels = [self.step1_label, self.step2_label, self.step3_label]
        colors = [self.colors['muted']] * 3

        for i in range(step - 1):
            colors[i] = self.colors['success']

        if completed:
            colors[step - 1] = self.colors['success']
        else:
            colors[step - 1] = self.colors['warning']

        for i, label in enumerate(labels):
            label.config(fg=colors[i])

        # Update canvas
        self.fingerprint_canvas.delete("all")
        color = self.colors['success'] if completed else self.colors['warning']
        self.fingerprint_canvas.create_oval(50, 50, 150, 150, outline=color, width=3)
        self.fingerprint_canvas.create_text(100, 100, text="👆", font=('Segoe UI', 40))

    def enrollment_success(self, name: str, fp_id: int):
        self.capture_status.config(text=f"✅ SUCCESS! Enrolled as ID {fp_id}")
        self.step3_label.config(fg=self.colors['success'])

        self.fingerprint_canvas.delete("all")
        self.fingerprint_canvas.create_oval(50, 50, 150, 150, outline=self.colors['success'], width=4)
        self.fingerprint_canvas.create_text(100, 100, text="✓", font=('Segoe UI', 50, 'bold'), fill=self.colors['success'])

        self.log(f"Enrollment complete: {name} -> ID {fp_id}", "success")

        # Update sensor count
        count = self.sensor.get_template_count()
        port = self.port_combo.get()
        self.sensor_info.config(text=f"Sensor: {port} | Fingerprints: {count}")

        # Reset for next enrollment
        self.current_student = None
        self.enrollment_entry.delete(0, tk.END)
        self.enroll_btn.config(text="Start Enrollment", state=tk.DISABLED)

        messagebox.showinfo("Success", f"Fingerprint enrolled successfully!\n\nStudent: {name}\nFingerprint ID: {fp_id}")

    def enrollment_error(self, message: str):
        self.capture_status.config(text=f"❌ {message}")
        self.enroll_btn.config(state=tk.NORMAL if self.is_connected else tk.DISABLED)

        self.fingerprint_canvas.delete("all")
        self.fingerprint_canvas.create_oval(50, 50, 150, 150, outline=self.colors['danger'], width=3)
        self.fingerprint_canvas.create_text(100, 100, text="✗", font=('Segoe UI', 50, 'bold'), fill=self.colors['danger'])

        self.log(f"Enrollment failed: {message}", "error")
        messagebox.showerror("Error", message)

    def verify_fingerprint(self):
        if not self.is_connected:
            messagebox.showwarning("Warning", "Please connect to sensor first")
            return

        self.log("Starting fingerprint verification...")

        def verify_thread():
            self.root.after(0, lambda: self.capture_status.config(text="Place finger to verify..."))

            timeout = time.time() + 10
            while time.time() < timeout:
                result = self.sensor.capture_image()
                if result == R307Sensor.FINGERPRINT_OK:
                    break
                time.sleep(0.1)
            else:
                self.root.after(0, lambda: self.log("Timeout - no finger detected", "error"))
                return

            result = self.sensor.image_to_tz(1)
            if result != R307Sensor.FINGERPRINT_OK:
                self.root.after(0, lambda: self.log("Failed to process fingerprint", "error"))
                return

            result, fp_id, confidence = self.sensor.search()

            if result == R307Sensor.FINGERPRINT_OK:
                self.root.after(0, lambda: self.handle_verify_match(fp_id, confidence))
            else:
                self.root.after(0, lambda: self.log("No match found - fingerprint not registered", "warning"))
                self.root.after(0, lambda: messagebox.showinfo("Result", "No match found!\nFingerprint is not registered."))

        threading.Thread(target=verify_thread, daemon=True).start()

    def handle_verify_match(self, fp_id: int, confidence: int):
        self.log(f"Match found! ID: {fp_id}, Confidence: {confidence}", "success")
        messagebox.showinfo("Match Found", f"Fingerprint identified!\n\nID: {fp_id}\nConfidence: {confidence}")

    def view_enrolled(self):
        self.log("Fetching enrolled students...")

        enrolled = self.supabase.get_all_enrolled()

        if not enrolled:
            messagebox.showinfo("Enrolled Students", "No students enrolled yet.")
            return

        # Create popup window
        popup = tk.Toplevel(self.root)
        popup.title("Enrolled Students")
        popup.geometry("500x400")
        popup.configure(bg=self.colors['bg'])

        # Treeview
        tree = ttk.Treeview(popup, columns=('ID', 'Name', 'Enrollment', 'Roll'), show='headings')
        tree.heading('ID', text='FP ID')
        tree.heading('Name', text='Name')
        tree.heading('Enrollment', text='Enrollment No')
        tree.heading('Roll', text='Roll')

        tree.column('ID', width=50)
        tree.column('Name', width=200)
        tree.column('Enrollment', width=150)
        tree.column('Roll', width=50)

        for item in enrolled:
            student = item.get('students', {})
            tree.insert('', tk.END, values=(
                item.get('fingerprint_id', ''),
                student.get('name', ''),
                student.get('enrollment_no', ''),
                student.get('roll_no', '')
            ))

        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.log(f"Found {len(enrolled)} enrolled students", "success")

    def delete_single(self):
        if not self.is_connected:
            messagebox.showwarning("Warning", "Please connect to sensor first")
            return

        fp_id = tk.simpledialog.askinteger("Delete Fingerprint", "Enter Fingerprint ID to delete:")
        if fp_id is None:
            return

        if messagebox.askyesno("Confirm", f"Delete fingerprint ID {fp_id}?"):
            result = self.sensor.delete_model(fp_id)
            if result == R307Sensor.FINGERPRINT_OK:
                self.log(f"Deleted fingerprint ID {fp_id}", "success")
                messagebox.showinfo("Success", f"Fingerprint {fp_id} deleted from sensor.\n\nNote: Database record not removed.")
            else:
                self.log(f"Failed to delete fingerprint {fp_id}", "error")
                messagebox.showerror("Error", "Failed to delete fingerprint")

    def clear_all(self):
        if not self.is_connected:
            messagebox.showwarning("Warning", "Please connect to sensor first")
            return

        if messagebox.askyesno("Warning", "This will delete ALL fingerprints from the sensor!\n\nAre you sure?"):
            if messagebox.askyesno("Final Confirm", "This action cannot be undone!\n\nProceed?"):
                result = self.sensor.empty_database()
                if result == R307Sensor.FINGERPRINT_OK:
                    self.log("All fingerprints deleted from sensor!", "warning")
                    self.sensor_info.config(text=f"Sensor: {self.port_combo.get()} | Fingerprints: 0")
                    messagebox.showinfo("Success", "All fingerprints deleted from sensor.")
                else:
                    self.log("Failed to clear database", "error")
                    messagebox.showerror("Error", "Failed to clear database")


# ==================== MAIN ====================
def main():
    root = tk.Tk()
    app = FingerprintEnrollmentApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
