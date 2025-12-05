import { supabase } from '@/integrations/supabase/client';

export interface SyllabusTopic {
  id: string;
  subject_id: string;
  unit_no: number;
  topic_text: string;
  created_at: string;
  covered_count?: number;
}

export interface SyllabusCoverage {
  id: string;
  syllabus_topic_id: string;
  session_id: string;
  created_at: string;
}

// Get all topics for a subject with coverage count
export async function getSyllabusTopics(subjectId: string): Promise<SyllabusTopic[]> {
  const { data, error } = await supabase
    .from('syllabus_topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('unit_no', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as SyllabusTopic[];
}

// Get topics with their coverage count
export async function getTopicsWithCoverage(subjectId: string): Promise<SyllabusTopic[]> {
  const topics = await getSyllabusTopics(subjectId);

  // Get coverage counts for each topic
  const { data: coverageData } = await supabase
    .from('syllabus_coverage')
    .select('syllabus_topic_id')
    .in('syllabus_topic_id', topics.map(t => t.id));

  const coverageMap = new Map<string, number>();
  coverageData?.forEach(c => {
    coverageMap.set(c.syllabus_topic_id, (coverageMap.get(c.syllabus_topic_id) || 0) + 1);
  });

  return topics.map(topic => ({
    ...topic,
    covered_count: coverageMap.get(topic.id) || 0
  }));
}

export async function createSyllabusTopic(topic: {
  subject_id: string;
  unit_no: number;
  topic_text: string;
}) {
  // Validate
  if (!topic.topic_text || topic.topic_text.trim().length < 3) {
    throw new Error('Topic text must be at least 3 characters');
  }
  if (topic.unit_no < 1 || topic.unit_no > 5) {
    throw new Error('Unit must be 1-5');
  }

  const { data, error } = await supabase
    .from('syllabus_topics')
    .insert({ ...topic, topic_text: topic.topic_text.trim() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSyllabusTopic(id: string, updates: { unit_no?: number; topic_text?: string }) {
  if (updates.topic_text && updates.topic_text.trim().length < 3) {
    throw new Error('Topic text must be at least 3 characters');
  }
  if (updates.unit_no && (updates.unit_no < 1 || updates.unit_no > 5)) {
    throw new Error('Unit must be 1-5');
  }

  const { data, error } = await supabase
    .from('syllabus_topics')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete topic with cascade option
export async function deleteSyllabusTopic(id: string, forceCascade: boolean = false): Promise<{ deleted: boolean; removedCoverageCount: number }> {
  // Check coverage count
  const { count } = await supabase
    .from('syllabus_coverage')
    .select('*', { count: 'exact', head: true })
    .eq('syllabus_topic_id', id);

  const coverageCount = count || 0;

  if (coverageCount > 0 && !forceCascade) {
    throw new Error(`COVERAGE_EXISTS:${coverageCount}`);
  }

  // Delete coverage records first (cascade)
  if (coverageCount > 0) {
    await supabase
      .from('syllabus_coverage')
      .delete()
      .eq('syllabus_topic_id', id);
  }

  // Delete topic
  const { error } = await supabase
    .from('syllabus_topics')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { deleted: true, removedCoverageCount: coverageCount };
}

// Get coverage for a specific session
export async function getCoverageForSession(sessionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('syllabus_coverage')
    .select('syllabus_topic_id')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data?.map(c => c.syllabus_topic_id) || [];
}

// Save coverage for session (replace existing)
export async function saveCoverageForSession(sessionId: string, topicIds: string[]): Promise<void> {
  // Delete existing coverage for this session
  await supabase
    .from('syllabus_coverage')
    .delete()
    .eq('session_id', sessionId);

  // Insert new coverage
  if (topicIds.length > 0) {
    const records = topicIds.map(topicId => ({
      session_id: sessionId,
      syllabus_topic_id: topicId,
    }));

    const { error } = await supabase
      .from('syllabus_coverage')
      .insert(records);

    if (error) throw error;
  }
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
  return saveCoverageForSession(sessionId, topicIds);
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
