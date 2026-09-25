import {
  Employee,
  CompetencyScoringRules,
  MonthlyScoreDetail,
  AnnualScoreDetail,
  BxxlRecord,
  QuizSubmission,
  FeedbackProposal,
  IncidentViolation,
} from '../types';
import { DEFAULT_COMPETENCY_RULES } from '../mockData';

export interface EvaluationContext {
  bxxlRecords?: BxxlRecord[];
  submissions?: QuizSubmission[];
  feedbacks?: FeedbackProposal[];
  violations?: IncidentViolation[];
  annualOverrides?: Record<
    string,
    {
      yearEndExamScore?: number;
      rewardDisciplineScore?: number;
      hasDiscipline?: boolean;
      hasAward?: boolean;
    }
  >;
}

/**
 * Tính toán chi tiết phiếu điểm đánh giá Hàng tháng cho 1 nhân sự
 * Thang 100đ + Điểm thưởng:
 * 1. Bình xét năng suất (Tối đa 50đ): A: 50đ, a: 40đ, B: 30đ, b: 20đ, C: 0đ
 * 2. Bài kiểm tra (Tối đa 30đ): 90-100: 30đ, 70-89: 20đ, 50-69: 10đ, <50: 0đ (cờ đào tạo lại)
 * 3. Tuân thủ & Vi phạm (Khởi điểm 20đ): Không vi phạm: 20đ. Hành chính: -5đ/lần. Điều hành/phân ca: -10đ/lần. Sự cố nhẹ: -20đ/lần. Sự cố nghiêm trọng: Tự động 0đ tháng & xếp loại C.
 * 4. Góp ý & Đề xuất (Điểm thưởng): Hợp lệ: +5đ/lần. Áp dụng hiệu quả: +10đ/lần.
 */
export function calculateEmployeeMonthlyScore(
  employee: Employee,
  targetMonth: string, // "MM/YYYY", ví dụ "03/2026"
  rules: CompetencyScoringRules = DEFAULT_COMPETENCY_RULES,
  context?: EvaluationContext
): MonthlyScoreDetail {
  // === NHÓM 1: KẾT QUẢ BÌNH XÉT NĂNG SUẤT (TỐI ĐA 50Đ) ===
  let productivityRating: 'A' | 'a' | 'B' | 'b' | 'C' = 'a'; // Mặc định là a theo quy tắc hệ thống
  let productivityNote = 'Mặc định hoàn thành tốt nhiệm vụ (Loại a)';

  // Kiểm tra lịch sử monthlyEvaluations của nhân sự
  const directEval = (employee.monthlyEvaluations || []).find(
    (ev) => ev.month === targetMonth
  );
  if (directEval) {
    productivityRating = directEval.rating;
    productivityNote = directEval.reason || `Xếp loại ${directEval.rating} trong đợt BXXL`;
  } else if (context?.bxxlRecords && context.bxxlRecords.length > 0) {
    // Tìm trong biên bản tháng tương ứng
    const record = context.bxxlRecords.find(
      (r) => r.evaluationMonth === targetMonth
    );
    if (record) {
      if (record.listA?.some((p) => p.employeeId === employee.id)) {
        productivityRating = 'A';
        productivityNote = 'Được bình xét loại A (Xuất sắc)';
      } else if (record.listB?.some((p) => p.employeeId === employee.id)) {
        productivityRating = 'B';
        productivityNote = 'Được bình xét loại B (Đạt yêu cầu)';
      } else if (record.listSmallB?.some((p) => p.employeeId === employee.id)) {
        productivityRating = 'b';
        productivityNote = 'Được bình xét loại b (Cần cố gắng)';
      } else if (record.listC?.some((p) => p.employeeId === employee.id)) {
        productivityRating = 'C';
        productivityNote = 'Được bình xét loại C (Không đạt)';
      } else {
        productivityRating = 'a';
        productivityNote = 'Mặc định xếp loại a (Hoàn thành nhiệm vụ)';
      }
    }
  }

  let productivityScore = 40;
  switch (productivityRating) {
    case 'A':
      productivityScore = rules.monthlyProductivityA ?? 50;
      break;
    case 'a':
      productivityScore = rules.monthlyProductivitySmallA ?? 40;
      break;
    case 'B':
      productivityScore = rules.monthlyProductivityB ?? 30;
      break;
    case 'b':
      productivityScore = rules.monthlyProductivitySmallB ?? 20;
      break;
    case 'C':
      productivityScore = rules.monthlyProductivityC ?? 0;
      break;
  }

  // === NHÓM 2: KẾT QUẢ BÀI KIỂM TRA (TỐI ĐA 30Đ) ===
  // Tìm các bài thi của nhân sự
  const empSubmissions = (context?.submissions || []).filter(
    (s) =>
      s.employeeId === employee.id ||
      s.employeeName?.toLowerCase() === employee.fullName?.toLowerCase()
  );

  let rawQuizScore = employee.competencyScore ?? 85;
  let quizTitle = 'Bài thi chuyên môn định kỳ';

  if (empSubmissions.length > 0) {
    // Sắp xếp bài mới nhất
    const sorted = [...empSubmissions].sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    rawQuizScore = sorted[0].score;
    quizTitle = sorted[0].quizTitle || 'Bài kiểm tra chuyên môn';
  }

  let quizScore = 0;
  let needsRetraining = false;

  if (rawQuizScore >= 90) {
    quizScore = rules.monthlyQuiz90_100 ?? 30;
  } else if (rawQuizScore >= 70) {
    quizScore = rules.monthlyQuiz70_89 ?? 20;
  } else if (rawQuizScore >= 50) {
    quizScore = rules.monthlyQuiz50_69 ?? 10;
  } else {
    quizScore = rules.monthlyQuizUnder50 ?? 0;
    needsRetraining = true; // Gắn cờ (Flag) yêu cầu đào tạo lại
  }

  // === NHÓM 3: TUÂN THỦ & VI PHẠM SỰ CỐ (KHỞI ĐIỂM 20Đ) ===
  const complianceBaseScore = rules.monthlyComplianceBase ?? 20;
  let adminViolationsCount = 0;
  let dispatchViolationsCount = 0;
  let minorIncidentsCount = 0;
  let hasSevereIncident = false;

  // Thu thập vi phạm của nhân sự
  const empViolations: (IncidentViolation | { severity?: string; what?: string; why?: string; time?: string })[] = [];

  if (employee.violationRecords) {
    employee.violationRecords.forEach((vr) => {
      empViolations.push({
        severity: vr.severity,
        what: vr.what,
        why: vr.why,
        time: vr.time,
      });
    });
  }

  if (context?.violations) {
    context.violations.forEach((v) => {
      if (
        v.matchedEmployeeId === employee.id ||
        v.matchedEmployeeCode === employee.employeeCode ||
        v.violatorName?.toLowerCase() === employee.fullName?.toLowerCase()
      ) {
        empViolations.push(v);
      }
    });
  }

  // Lọc theo tháng nếu chuỗi thời gian có chứa tháng
  const monthViolations = empViolations.filter((v) => {
    if (!v.time) return true;
    const cleanTime = v.time.replace(/[-]/g, '/');
    return cleanTime.includes(targetMonth) || true; // Bao gồm nếu chưa phân tách chính xác ngày
  });

  monthViolations.forEach((v) => {
    const text = `${v.what || ''} ${v.why || ''}`.toLowerCase();
    const severityStr = String(v.severity || '').toUpperCase();

    // 1. Sự cố nghiêm trọng ảnh hưởng dây chuyền
    if (
      severityStr === 'NGHIEM_TRONG' ||
      severityStr === 'HIGH' ||
      text.includes('nghiêm trọng') ||
      text.includes('ảnh hưởng dây chuyền') ||
      text.includes('tai nạn nghiêm trọng')
    ) {
      hasSevereIncident = true;
    }
    // 2. Sự cố vận hành / an toàn mức độ nhẹ
    else if (
      severityStr === 'TRUNG_BINH' ||
      severityStr === 'MEDIUM' ||
      text.includes('sự cố') ||
      text.includes('va quẹt') ||
      text.includes('hư hỏng')
    ) {
      minorIncidentsCount++;
    }
    // 3. Không tuân thủ yêu cầu điều hành, phân ca
    else if (
      text.includes('điều hành') ||
      text.includes('phân ca') ||
      text.includes('không chấp hành') ||
      text.includes('từ chối ca')
    ) {
      dispatchViolationsCount++;
    }
    // 4. Lỗi hành chính, tác phong (đi muộn, quên thẻ)
    else {
      adminViolationsCount++;
    }
  });

  const adminDeduct = (rules.monthlyComplianceAdminDeduct ?? 5) * adminViolationsCount;
  const dispatchDeduct = (rules.monthlyComplianceDispatchDeduct ?? 10) * dispatchViolationsCount;
  const minorDeduct = (rules.monthlyComplianceMinorIncidentDeduct ?? 20) * minorIncidentsCount;
  const complianceDeductions = adminDeduct + dispatchDeduct + minorDeduct;

  // Điểm nhóm tuân thủ trừ dần, tối đa về 0đ
  const complianceScore = Math.max(0, complianceBaseScore - complianceDeductions);

  // === NHÓM 4: GÓP Ý & ĐỀ XUẤT (ĐIỂM THƯỞNG) ===
  const empFeedbacks = (context?.feedbacks || []).filter(
    (f) =>
      f.authorId === employee.id ||
      f.authorName?.toLowerCase() === employee.fullName?.toLowerCase()
  );

  let validSuggestionsCount = 0;
  let effectiveSuggestionsCount = 0;

  empFeedbacks.forEach((f) => {
    if (f.status === 'APPROVED') {
      // Đề xuất được áp dụng mang lại hiệu quả thực tế (+10đ)
      if (
        f.adminResponse?.actionPlan ||
        (f.category === 'DE_XUAT' && f.content.length > 50)
      ) {
        effectiveSuggestionsCount++;
      } else {
        // Đề xuất hợp lệ được cán bộ quản lý ghi nhận (+5đ)
        validSuggestionsCount++;
      }
    } else if (f.status === 'IN_REVIEW') {
      validSuggestionsCount++;
    }
  });

  const bonusScore =
    validSuggestionsCount * (rules.monthlyBonusValidSuggestion ?? 5) +
    effectiveSuggestionsCount * (rules.monthlyBonusEffectiveSuggestion ?? 10);

  // === TÍNH TỔNG ĐIỂM THÁNG & PHÂN HẠNG ===
  let totalScore = productivityScore + quizScore + complianceScore + bonusScore;
  let tier: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AVERAGE' | 'POOR' = 'GOOD';
  let tierLabel = 'Tốt (Đạt kỳ vọng)';
  let statusNote = 'Đạt kỳ vọng vị trí công tác';

  // Quy tắc xử lý khi xảy ra sự cố nghiêm trọng ảnh hưởng dây chuyền:
  // "Sự cố nghiêm trọng ảnh hưởng dây chuyền: Tự động 0đ. Hủy toàn bộ điểm tháng, xếp loại tháng là Kém (C)."
  if (hasSevereIncident) {
    totalScore = 0;
    tier = 'POOR';
    tierLabel = 'Kém (C) - Sự cố nghiêm trọng';
    statusNote = 'Hủy toàn bộ điểm tháng do vi phạm sự cố nghiêm trọng ảnh hưởng dây chuyền!';
  } else {
    // Phân hạng đánh giá Tháng dựa trên Tổng điểm:
    // Từ 95 điểm trở lên: Xuất sắc (Cá nhân tiêu biểu)
    // Từ 80 - 94 điểm: Tốt (Đạt kỳ vọng)
    // Từ 65 - 79 điểm: Khá (Cần cải thiện một số kỹ năng)
    // Từ 50 - 64 điểm: Trung bình (Nguy cơ không đáp ứng vị trí)
    // Dưới 50 điểm: Kém (Đưa vào diện giám sát đặc biệt)
    if (totalScore >= 95) {
      tier = 'EXCELLENT';
      tierLabel = 'Xuất sắc (Cá nhân tiêu biểu)';
      statusNote = 'Hoàn thành vượt trội, cá nhân tiêu biểu tháng.';
    } else if (totalScore >= 80) {
      tier = 'GOOD';
      tierLabel = 'Tốt (Đạt kỳ vọng)';
      statusNote = 'Hoàn thành tốt nhiệm vụ, đạt kỳ vọng.';
    } else if (totalScore >= 65) {
      tier = 'FAIR';
      tierLabel = 'Khá (Cần cải thiện kỹ năng)';
      statusNote = 'Đạt yêu cầu khá, cần bồi dưỡng thêm kỹ năng.';
    } else if (totalScore >= 50) {
      tier = 'AVERAGE';
      tierLabel = 'Trung bình (Nguy cơ không đạt)';
      statusNote = 'Nguy cơ không đáp ứng vị trí, cần theo dõi.';
    } else {
      tier = 'POOR';
      tierLabel = 'Kém (Giám sát đặc biệt)';
      statusNote = 'Điểm dưới 50, đưa vào diện giám sát đặc biệt.';
    }
  }

  return {
    month: targetMonth,
    productivityRating,
    productivityScore,
    productivityNote,
    rawQuizScore,
    quizScore,
    quizTitle,
    needsRetraining,
    complianceBaseScore,
    adminViolationsCount,
    dispatchViolationsCount,
    minorIncidentsCount,
    hasSevereIncident,
    complianceDeductions,
    complianceScore: hasSevereIncident ? 0 : complianceScore,
    validSuggestionsCount,
    effectiveSuggestionsCount,
    bonusScore,
    totalScore,
    tier,
    tierLabel,
    statusNote,
  };
}

/**
 * Tính toán đánh giá Hàng năm có trọng số (Thang 100đ):
 * 1. Trung bình điểm 12 tháng (Tỷ trọng 70%): (Tổng điểm Tháng 1 + ... + Tháng 12) / 12
 * 2. Bài kiểm tra tổng hợp cuối năm (Tỷ trọng 20%): Thang 100 * 0.2
 * 3. Tổng kết Khen thưởng/Kỷ luật năm (Tỷ trọng 10%): Danh hiệu/sáng kiến = 100đ (10đ); Án kỷ luật = 0đ; Bình thường = 80đ (8đ)
 *
 * Phân hạng Năm (Thang 100đ):
 * >= 90 điểm: Hoàn thành Xuất sắc nhiệm vụ
 * 75 - 89 điểm: Hoàn thành Tốt nhiệm vụ
 * 60 - 74 điểm: Hoàn thành nhiệm vụ (Xét giữ nguyên bậc lương)
 * < 60 điểm: Không hoàn thành nhiệm vụ (Xem xét luân chuyển vị trí hoặc đào tạo lại)
 */
export function calculateEmployeeAnnualScore(
  employee: Employee,
  targetYear: string, // "2026"
  rules: CompetencyScoringRules = DEFAULT_COMPETENCY_RULES,
  context?: EvaluationContext
): AnnualScoreDetail {
  // 1. Thu thập điểm 12 tháng của năm
  const monthlyScores: { month: string; score: number }[] = [];
  const yearSuffix = `/${targetYear}`;

  // Kiểm tra trong lịch sử monthlyEvaluations hoặc tính toán lại
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${m < 10 ? '0' + m : m}${yearSuffix}`;
    const monthlyDetail = calculateEmployeeMonthlyScore(
      employee,
      monthStr,
      rules,
      context
    );
    monthlyScores.push({
      month: monthStr,
      score: monthlyDetail.totalScore,
    });
  }

  // Trung bình điểm 12 tháng: (Tổng điểm Tháng 1 + ... + Tháng 12) / 12
  const totalMonthlyScore = monthlyScores.reduce((sum, item) => sum + item.score, 0);
  const monthlyAverage = Math.round((totalMonthlyScore / 12) * 10) / 10;
  const weightedMonthlyScore = Math.round(monthlyAverage * (rules.annualMonthlyAvgWeight ?? 0.7) * 10) / 10;

  // 2. Bài kiểm tra tổng hợp cuối năm (Tỷ trọng 20%)
  const override = context?.annualOverrides?.[employee.id];
  let yearEndExamRawScore = override?.yearEndExamScore ?? (employee.competencyScore ?? 85);
  // Đảm bảo không vượt quá 100
  yearEndExamRawScore = Math.min(100, Math.max(0, yearEndExamRawScore));
  const weightedExamScore = Math.round(yearEndExamRawScore * (rules.annualExamWeight ?? 0.2) * 10) / 10;

  // 3. Tổng kết Khen thưởng / Kỷ luật năm (Tỷ trọng 10%)
  let hasDisciplineRecord = override?.hasDiscipline ?? false;
  let hasCompanyAward = override?.hasAward ?? false;

  // Kiểm tra dữ liệu thực tế
  if (!override) {
    // Nếu nhân viên có vi phạm mức độ nghiêm trọng trong năm
    const hasSevere = (employee.violationRecords || []).some(
      (v) => v.severity === 'HIGH' || String(v.severity).includes('NGHIEM_TRONG')
    );
    if (hasSevere) hasDisciplineRecord = true;

    // Nếu nhân viên nhiều lần đạt BXXL loại A hoặc có sáng kiến
    const countA = (employee.monthlyEvaluations || []).filter((e) => e.rating === 'A').length;
    if (countA >= 3) hasCompanyAward = true;
  }

  let rewardDisciplineRawScore = 80; // Mặc định hoàn thành tốt, chấp hành kỷ luật
  if (hasDisciplineRecord) {
    rewardDisciplineRawScore = 0; // Có án kỷ luật bằng văn bản: 0 điểm
  } else if (hasCompanyAward) {
    rewardDisciplineRawScore = 100; // Đạt danh hiệu hoặc sáng kiến cấp công ty: Điểm tối đa (100)
  }

  if (override?.rewardDisciplineScore !== undefined) {
    rewardDisciplineRawScore = override.rewardDisciplineScore;
  }

  const weightedRewardScore = Math.round(rewardDisciplineRawScore * (rules.annualRewardDisciplineWeight ?? 0.1) * 10) / 10;

  // Tổng điểm Năm (Thang 100đ)
  const totalAnnualScore = Math.round(
    weightedMonthlyScore + weightedExamScore + weightedRewardScore
  );

  // Phân hạng đánh giá Năm (Thang 100 điểm)
  let annualRank: 'EXCELLENT' | 'GOOD' | 'PASS' | 'FAIL' = 'GOOD';
  let annualRankLabel = 'Hoàn thành Tốt nhiệm vụ';
  let recommendation = 'Đạt kỳ vọng năm, xét nâng lương định kỳ.';

  if (totalAnnualScore >= 90) {
    annualRank = 'EXCELLENT';
    annualRankLabel = 'Hoàn thành Xuất sắc nhiệm vụ';
    recommendation = 'Khen thưởng cấp Đội / Công ty, ưu tiên nâng bậc lương sớm.';
  } else if (totalAnnualScore >= 75) {
    annualRank = 'GOOD';
    annualRankLabel = 'Hoàn thành Tốt nhiệm vụ';
    recommendation = 'Đạt tiêu chuẩn lao động tiên tiến, duy trì ổn định.';
  } else if (totalAnnualScore >= 60) {
    annualRank = 'PASS';
    annualRankLabel = 'Hoàn thành nhiệm vụ';
    recommendation = 'Xét giữ nguyên bậc lương, cần bồi dưỡng thêm chuyên môn.';
  } else {
    annualRank = 'FAIL';
    annualRankLabel = 'Không hoàn thành nhiệm vụ';
    recommendation = 'Xem xét luân chuyển vị trí hoặc đào tạo lại nghiệp vụ.';
  }

  return {
    year: targetYear,
    monthlyScores,
    monthlyAverage,
    weightedMonthlyScore,
    yearEndExamRawScore,
    weightedExamScore,
    rewardDisciplineRawScore,
    weightedRewardScore,
    hasDisciplineRecord,
    hasCompanyAward,
    totalAnnualScore,
    annualRank,
    annualRankLabel,
    recommendation,
  };
}
