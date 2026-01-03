import { supabase } from '@/integrations/supabase/client';

export interface SyllabusTopic {
  id: string;
  subject_id: string;
  unit_no: number;
  topic_text: string;
  created_at: string;
  updated_at: string;
  covered_count?: number;
}

export interface SyllabusCoverage {
  id: string;
  session_id: string;
  topic_id: string;
  created_at: string;
}

export async function getSyllabusTopics(subjectId: string) {
  const { data, error } = await supabase
    .from('syllabus_topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('unit_no', { ascending: true })
    .order('topic_text', { ascending: true });

  if (error) throw error;
  return data as SyllabusTopic[];
}

export async function getTopicsWithCoverage(subjectId: string) {
  const { data: topics, error: topicsError } = await supabase
    .from('syllabus_topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('unit_no', { ascending: true })
    .order('topic_text', { ascending: true });

  if (topicsError) throw topicsError;

  // Get all coverage for these topics
  // Note: This might be inefficient for large datasets, but for a single subject it should be fine.
  // A better approach would be a join or a count query if Supabase supports it easily on the client.
  // select('*, syllabus_coverage(count)') works if foreign key is set up correctly.
  // Let's try the manual aggregation for now to be safe.
  
  if (topics.length === 0) return [];

  const { data: coverage, error: coverageError } = await supabase
    .from('syllabus_coverage')
    .select('topic_id')
    .in('topic_id', topics.map(t => t.id));
    
  if (coverageError) throw coverageError;
  
  const coverageMap = coverage.reduce((acc, curr) => {
    acc[curr.topic_id] = (acc[curr.topic_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return topics.map(topic => ({
    ...topic,
    covered_count: coverageMap[topic.id] || 0
  })) as SyllabusTopic[];
}

export async function getSyllabusProgress(subjectId: string) {
  const topics = await getTopicsWithCoverage(subjectId);
  
  const totalTopics = topics.length;
  const coveredTopics = topics.filter(t => (t.covered_count || 0) > 0).length;
  const percentage = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;
  
  const unitProgress: Record<number, { total: number; covered: number }> = {};
  
  topics.forEach(topic => {
    const unit = topic.unit_no || 1;
    if (!unitProgress[unit]) {
      unitProgress[unit] = { total: 0, covered: 0 };
    }
    unitProgress[unit].total++;
    if ((topic.covered_count || 0) > 0) {
      unitProgress[unit].covered++;
    }
  });
  
  return {
    totalTopics,
    coveredTopics,
    percentage,
    unitProgress
  };
}

export async function getCoverageForSession(sessionId: string) {
  const { data, error } = await supabase
    .from('syllabus_coverage')
    .select('*')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data as SyllabusCoverage[];
}

export async function markTopicsCovered(sessionId: string, topicIds: string[]) {
  // First, delete existing coverage for this session to avoid duplicates/stale data
  const { error: deleteError } = await supabase
    .from('syllabus_coverage')
    .delete()
    .eq('session_id', sessionId);

  if (deleteError) throw deleteError;

  if (topicIds.length === 0) return;

  const records = topicIds.map(topicId => ({
    session_id: sessionId,
    topic_id: topicId
  }));

  const { error } = await supabase
    .from('syllabus_coverage')
    .insert(records);

  if (error) throw error;
}
