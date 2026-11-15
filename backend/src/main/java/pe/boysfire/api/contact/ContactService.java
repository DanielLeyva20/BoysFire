package pe.boysfire.api.contact;

import java.security.SecureRandom;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import pe.boysfire.api.common.error.ResourceNotFoundException;
import pe.boysfire.api.region.Region;
import pe.boysfire.api.region.RegionService;

/**
 * Responsables y autoridades de cada localidad. Una alerta de una zona llega a quienes
 * están a cargo de esa zona, de las zonas que la contienen y de las que están dentro de ella.
 */
@Service
public class ContactService {

    /** Sin letras ni números que se confundan al dictarlos (0/O, 1/I/L). */
    private static final char[] CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int CODE_LENGTH = 8;

    private final ContactRepository repository;
    private final RegionService regions;
    private final SecureRandom random = new SecureRandom();

    ContactService(ContactRepository repository, RegionService regions) {
        this.repository = repository;
        this.regions = regions;
    }

    public Contact create(int regionId, String fullName, String roleName, ContactKind kind, String phone) {
        regions.require(regionId);
        int id = repository.insert(regionId, fullName.strip(), roleName.strip(), kind, blankToNull(phone), newLinkCode());
        return require(id);
    }

    public Contact require(int contactId) {
        return repository.find(contactId)
                .orElseThrow(() -> new ResourceNotFoundException("No existe el contacto " + contactId + "."));
    }

    public List<Contact> active() {
        return repository.findActive();
    }

    public void deactivate(int contactId) {
        require(contactId);
        repository.deactivate(contactId);
    }

    /** Destinatarios de una alerta de la región: su zona, las que la contienen y las que contiene. */
    public List<Contact> recipientsFor(int regionId) {
        Set<Integer> regionIds = new HashSet<>();
        regions.detail(regionId).ancestors().forEach(ancestor -> regionIds.add(ancestor.id()));
        regionIds.addAll(withDescendants(regionId));
        return repository.findActiveInRegions(regionIds);
    }

    /** Cuántos contactos activos cubren una región (incluidos los de las zonas que la contienen). */
    public int coverageOf(int regionId) {
        return recipientsFor(regionId).size();
    }

    public Optional<Contact> findByChatId(long chatId) {
        return repository.findByChatId(chatId);
    }

    /** Enlaza un chat de Telegram usando el código del contacto. Vacío si el código no existe. */
    public Optional<Contact> linkTelegram(String linkCode, long chatId) {
        Optional<Contact> contact = repository.findByLinkCode(linkCode.strip().toUpperCase());
        contact.ifPresent(found -> repository.linkTelegram(found.id(), chatId));
        return contact.map(found -> require(found.id()));
    }

    private Set<Integer> withDescendants(int regionId) {
        Set<Integer> result = new HashSet<>();
        Deque<Integer> pending = new ArrayDeque<>(List.of(regionId));
        while (!pending.isEmpty()) {
            int current = pending.pop();
            if (result.add(current)) {
                regions.children(current).stream().map(Region::id).forEach(pending::push);
            }
        }
        return result;
    }

    private String newLinkCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder(CODE_LENGTH);
            for (int index = 0; index < CODE_LENGTH; index++) {
                builder.append(CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)]);
            }
            code = builder.toString();
        } while (repository.linkCodeExists(code));
        return code;
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
