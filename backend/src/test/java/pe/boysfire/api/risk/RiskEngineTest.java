package pe.boysfire.api.risk;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import pe.boysfire.api.risk.Assessment.FactorScore;
import pe.boysfire.api.risk.RiskProperties.Thresholds;

class RiskEngineTest {

    private static final Thresholds THRESHOLDS = new Thresholds(50, 35, 21, 10, 1.0, 30, 45, 30, 0.5, 0.2, 0.02);
    private static final RiskEngine ENGINE = new RiskEngine(new RiskProperties(
            Duration.ofHours(3), Duration.ZERO, 7, 30, 50, "http://localhost", 3, 7, 10, THRESHOLDS));

    private static WeatherDay weather(double gust, int dryDays, int humidity, double temperature) {
        return new WeatherDay(LocalDate.of(2024, 9, 13), temperature, humidity, gust / 2, gust, 0, dryDays);
    }

    @Test
    void calmWetDayIsLowRiskWithoutFactors() {
        Assessment assessment = ENGINE.assess(weather(20, 2, 80, 22), null, null);

        assertThat(assessment.level()).isEqualTo(RiskLevel.LOW);
        assertThat(assessment.score()).isZero();
        assertThat(assessment.factors()).isEmpty();
    }

    @Test
    void drySeasonWithWindAndActiveFireIsHighRisk() {
        Assessment assessment = ENGINE.assess(weather(55, 25, 25, 31), 0.8, 12);

        assertThat(assessment.level()).isEqualTo(RiskLevel.HIGH);
        assertThat(assessment.score()).isEqualTo(11);
        assertThat(assessment.factors()).extracting(FactorScore::factor).containsExactly(
                RiskFactor.STRONG_WIND, RiskFactor.DRY_VEGETATION, RiskFactor.DRY_AIR, RiskFactor.HEAT,
                RiskFactor.FIRE_SEASON, RiskFactor.ACTIVE_FIRE);
    }

    @Test
    void moderateThresholdsGiveOnePointEach() {
        Assessment assessment = ENGINE.assess(weather(40, 12, 40, 25), 0.3, null);

        assertThat(assessment.factors()).allSatisfy(factor -> assertThat(factor.points()).isEqualTo(1));
        assertThat(assessment.score()).isEqualTo(4);
        assertThat(assessment.level()).isEqualTo(RiskLevel.MODERATE);
    }

    @Test
    void factorKeepsTheMeasuredValueToExplainIt() {
        Assessment assessment = ENGINE.assess(weather(62, 0, 90, 20), null, null);

        assertThat(assessment.factors()).singleElement()
                .satisfies(factor -> assertThat(factor.observedValue()).isEqualTo(62.0));
    }

    @Test
    void zeroDetectionsDoNotCountAsActiveFire() {
        assertThat(ENGINE.assess(null, null, 0).factors()).isEmpty();
    }

    @Test
    void summaryUsesTheScoreReachedByOneInFourZonesAndSharedFactors() {
        Assessment high = ENGINE.assess(weather(55, 25, 25, 31), 0.8, null);
        Assessment low = ENGINE.assess(weather(20, 2, 80, 22), null, null);

        Assessment summary = ENGINE.summarize(List.of(high, low, low, low, low, low, low, low));

        assertThat(summary.score()).isZero();
        assertThat(ENGINE.summarize(List.of(high, high, low, low)).level()).isEqualTo(RiskLevel.HIGH);
        assertThat(ENGINE.summarize(List.of(high, low, low, low)).factors())
                .allSatisfy(factor -> assertThat(factor.affectedShare()).isEqualTo(0.25));
    }

    @Test
    void scoreMapsToLevelsAtTheirThresholds() {
        assertThat(RiskLevel.fromScore(2)).isEqualTo(RiskLevel.LOW);
        assertThat(RiskLevel.fromScore(3)).isEqualTo(RiskLevel.MODERATE);
        assertThat(RiskLevel.fromScore(6)).isEqualTo(RiskLevel.HIGH);
    }

    @Test
    void seasonDayOfYearIgnoresLeapYears() {
        assertThat(RiskRefreshJob.seasonDayOfYear(LocalDate.of(2026, 3, 1))).isEqualTo(61);
        assertThat(RiskRefreshJob.seasonDayOfYear(LocalDate.of(2024, 3, 1))).isEqualTo(61);
    }
}
