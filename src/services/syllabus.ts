import { supabase } from '@/integrations/supabase/client';

export interface SyllabusTopic {
  id: string;
  subject_id: string;
  unit_no: number;
  topic_text: string;
  created_at: string;
}

export interface SyllabusCoverage {
  id: string;
  syllabus_topic_id: string;
  session_id: string;
  created_at: string;
}

export async function getSyllabusTopics(subjectId: string) {
  const { data, error } = await supabase
    .from('syllabus_topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('unit_no', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as SyllabusTopic[];
}

export async function createSyllabusTopic(topic: {
  subject_id: string;
  unit_no: number;
  topic_text: string;
}) {
  const { data, error } = await supabase
    .from('syllabus_topics')
    .insert(topic)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateSyllabusTopic(id: string, updates: Partial<SyllabusTopic>) {
  const { data, error } = await supabase
    .from('syllabus_topics')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteSyllabusTopic(id: string) {
  const { error } = await supabase
    .from('syllabus_topics')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function getSyllabusCoverage(subjectId: string) {
  const { data, error } = await supabase
    .from('syllabus_coverage')
    .select(`
      *,
      syllabus_topics!inner (id, subject_id, unit_no, topic_text)
    `)
    .eq('syllabus_topics.subject_id', subjectId);
  
  if (error) throw error;
  return data;
}

export async function markTopicsCovered(sessionId: string, topicIds: string[]) {
  const records = topicIds.map(topicId => ({
    session_id: sessionId,
    syllabus_topic_id: topicId,
  }));
  
  const { data, error } = await supabase
    .from('syllabus_coverage')
    .insert(records)
    .select();
  
  if (error) throw error;
  return data;
}

export async function getSyllabusProgress(subjectId: string) {
  const topics = await getSyllabusTopics(subjectId);
  const coverage = await getSyllabusCoverage(subjectId);
  
  const coveredTopicIds = new Set(coverage?.map(c => c.syllabus_topic_id) || []);
  const totalTopics = topics.length;
  const coveredTopics = topics.filter(t => coveredTopicIds.has(t.id)).length;
  
  const unitProgress: Record<number, { total: number; covered: number }> = {};
  
  topics.forEach(topic => {
    if (!unitProgress[topic.unit_no]) {
      unitProgress[topic.unit_no] = { total: 0, covered: 0 };
    }
    unitProgress[topic.unit_no].total++;
    if (coveredTopicIds.has(topic.id)) {
      unitProgress[topic.unit_no].covered++;
    }
  });
  
  return {
    totalTopics,
    coveredTopics,
    percentage: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
    unitProgress,
  };
}
