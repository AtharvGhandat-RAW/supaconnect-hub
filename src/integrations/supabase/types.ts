export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          message: string
          timestamp: string
          user_profile_id: string | null
        }
        Insert: {
          id?: string
          message: string
          timestamp?: string
          user_profile_id?: string | null
        }
        Update: {
          id?: string
          message?: string
          timestamp?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          id: string
          remark: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_mark_enum"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          remark?: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_mark_enum"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          remark?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_mark_enum"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          class_id: string
          created_at: string
          date: string
          faculty_id: string
          id: string
          is_substitution: boolean
          start_time: string
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          faculty_id: string
          id?: string
          is_substitution?: boolean
          start_time: string
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          faculty_id?: string
          id?: string
          is_substitution?: boolean
          start_time?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher_id: string | null
          created_at: string
          department: string | null
          division: string
          id: string
          name: string
          semester: number
          updated_at: string
          year: number
        }
        Insert: {
          class_teacher_id?: string | null
          created_at?: string
          department?: string | null
          division: string
          id?: string
          name: string
          semester: number
          updated_at?: string
          year: number
        }
        Update: {
          class_teacher_id?: string | null
          created_at?: string
          department?: string | null
          division?: string
          id?: string
          name?: string
          semester?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      faculty: {
        Row: {
          created_at: string
          department: string | null
          designation: string | null
          employee_code: string | null
          id: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_code?: string | null
          id?: string
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_code?: string | null
          id?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_leaves: {
        Row: {
          created_at: string
          date: string
          faculty_id: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type_enum"]
          reason: string | null
          status: Database["public"]["Enums"]["leave_status_enum"]
        }
        Insert: {
          created_at?: string
          date: string
          faculty_id: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type_enum"]
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status_enum"]
        }
        Update: {
          created_at?: string
          date?: string
          faculty_id?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type_enum"]
          reason?: string | null
          status?: Database["public"]["Enums"]["leave_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "faculty_leaves_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          id: string
          name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          ai_suggestion: boolean
          auto_substitution: boolean
          created_at: string
          current_academic_year: string
          current_semester: number
          defaulter_threshold: number
          id: string
          updated_at: string
        }
        Insert: {
          ai_suggestion?: boolean
          auto_substitution?: boolean
          created_at?: string
          current_academic_year?: string
          current_semester?: number
          defaulter_threshold?: number
          id?: string
          updated_at?: string
        }
        Update: {
          ai_suggestion?: boolean
          auto_substitution?: boolean
          created_at?: string
          current_academic_year?: string
          current_semester?: number
          defaulter_threshold?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_id: string | null
          created_at: string
          department: string | null
          division: string | null
          email: string | null
          enrollment_no: string | null
          id: string
          mobile: string | null
          name: string
          roll_no: number | null
          semester: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          department?: string | null
          division?: string | null
          email?: string | null
          enrollment_no?: string | null
          id?: string
          mobile?: string | null
          name: string
          roll_no?: number | null
          semester: number
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          class_id?: string | null
          created_at?: string
          department?: string | null
          division?: string | null
          email?: string | null
          enrollment_no?: string | null
          id?: string
          mobile?: string | null
          name?: string
          roll_no?: number | null
          semester?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_allocations: {
        Row: {
          class_id: string
          created_at: string
          faculty_id: string
          id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          faculty_id: string
          id?: string
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          faculty_id?: string
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_allocations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_allocations_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_allocations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          semester: number
          status: string
          subject_code: string
          type: Database["public"]["Enums"]["subject_type_enum"]
          updated_at: string
          weekly_lectures: number
          year: number
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          name: string
          semester: number
          status?: string
          subject_code: string
          type: Database["public"]["Enums"]["subject_type_enum"]
          updated_at?: string
          weekly_lectures?: number
          year: number
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          semester?: number
          status?: string
          subject_code?: string
          type?: Database["public"]["Enums"]["subject_type_enum"]
          updated_at?: string
          weekly_lectures?: number
          year?: number
        }
        Relationships: []
      }
      substitution_assignments: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          src_faculty_id: string
          start_time: string
          sub_faculty_id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          src_faculty_id: string
          start_time: string
          sub_faculty_id: string
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          src_faculty_id?: string
          start_time?: string
          sub_faculty_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitution_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_assignments_src_faculty_id_fkey"
            columns: ["src_faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_assignments_sub_faculty_id_fkey"
            columns: ["sub_faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitution_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_coverage: {
        Row: {
          created_at: string
          id: string
          session_id: string
          syllabus_topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          syllabus_topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          syllabus_topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_coverage_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syllabus_coverage_syllabus_topic_id_fkey"
            columns: ["syllabus_topic_id"]
            isOneToOne: false
            referencedRelation: "syllabus_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_topics: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          topic_text: string
          unit_no: number
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          topic_text: string
          unit_no: number
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          topic_text?: string
          unit_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: string
          faculty_id: string
          id: string
          room_no: string | null
          start_time: string
          subject_id: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: string
          faculty_id: string
          id?: string
          room_no?: string | null
          start_time: string
          subject_id: string
          valid_from: string
          valid_to: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: string
          faculty_id?: string
          id?: string
          room_no?: string | null
          start_time?: string
          subject_id?: string
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_faculty: { Args: never; Returns: boolean }
    }
    Enums: {
      attendance_mark_enum: "PRESENT" | "ABSENT"
      leave_status_enum: "PENDING" | "APPROVED" | "REJECTED"
      leave_type_enum: "FULL_DAY" | "HALF_MORNING" | "HALF_AFTERNOON"
      role_enum: "ADMIN" | "FACULTY"
      subject_type_enum: "TH" | "PR" | "TU"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attendance_mark_enum: ["PRESENT", "ABSENT"],
      leave_status_enum: ["PENDING", "APPROVED", "REJECTED"],
      leave_type_enum: ["FULL_DAY", "HALF_MORNING", "HALF_AFTERNOON"],
      role_enum: ["ADMIN", "FACULTY"],
      subject_type_enum: ["TH", "PR", "TU"],
    },
  },
} as const
