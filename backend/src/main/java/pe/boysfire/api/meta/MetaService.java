package pe.boysfire.api.meta;

import java.util.Map;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import pe.boysfire.api.calendar.ObservedRangeProvider;
import pe.boysfire.api.common.query.DateRange;
import pe.boysfire.api.meta.MetaRepository.PipelineRun;

@Service
public class MetaService {

    private final MetaRepository repository;
    private final ObservedRangeProvider observedRange;

    MetaService(MetaRepository repository, ObservedRangeProvider observedRange) {
        this.repository = repository;
        this.observedRange = observedRange;
    }

    @Cacheable("dataSummary")
    public DataSummary summary() {
        DateRange range = observedRange.get();
        Optional<PipelineRun> lastRun = repository.findLastSuccessfulRun();
        return new DataSummary(
                range.from(),
                range.to(),
                repository.countHotspots(),
                lastRun.map(PipelineRun::finishedAt).orElse(null),
                repository.findSourceDays(),
                lastRun.map(run -> repository.findRunMetrics(run.id())).orElse(Map.of()));
    }
}
