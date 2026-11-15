package pe.boysfire.api.contact;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.boysfire.api.notification.TelegramLinks;
import pe.boysfire.api.region.RegionService;

/** Solo operadores: contiene datos personales. */
@Tag(name = "Operación: responsables", description = "Responsables comunitarios y autoridades de cada localidad")
@RestController
@RequestMapping("/api/ops/contacts")
class ContactController {

    private final ContactService service;
    private final RegionService regions;
    private final TelegramLinks telegramLinks;

    ContactController(ContactService service, RegionService regions, TelegramLinks telegramLinks) {
        this.service = service;
        this.regions = regions;
        this.telegramLinks = telegramLinks;
    }

    record NewContact(
            @NotNull Integer regionId,
            @NotBlank @Size(max = 80) String fullName,
            @NotBlank @Size(max = 80) String roleName,
            @NotNull ContactKind kind,
            @Pattern(regexp = "^[+0-9 ]{0,20}$", message = "solo dígitos, espacios y +") String phone) {
    }

    /**
     * @param telegramLink enlace que abre el bot con el código ya escrito; {@code null} si el bot no está configurado
     */
    record ContactView(
            int id, int regionId, String place, String fullName, String roleName, ContactKind kind, String phone,
            boolean telegramLinked, String linkCode, String telegramLink) {
    }

    @Operation(summary = "Responsables activos")
    @GetMapping
    List<ContactView> list() {
        return service.active().stream().map(this::toView).toList();
    }

    @Operation(summary = "Registrar un responsable; devuelve su código para enlazar Telegram")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ContactView create(@Valid @RequestBody NewContact request) {
        return toView(service.create(request.regionId(), request.fullName(), request.roleName(), request.kind(), request.phone()));
    }

    @Operation(summary = "Dar de baja a un responsable (deja de recibir alertas)")
    @DeleteMapping("/{contactId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deactivate(@PathVariable int contactId) {
        service.deactivate(contactId);
    }

    private ContactView toView(Contact contact) {
        return new ContactView(
                contact.id(), contact.regionId(), regions.detail(contact.regionId()).path(), contact.fullName(),
                contact.roleName(), contact.kind(), contact.phone(), contact.hasTelegram(), contact.linkCode(),
                telegramLinks.startLink(contact.linkCode()).orElse(null));
    }
}
